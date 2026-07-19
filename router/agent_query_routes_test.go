package router

import (
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentQueryRoutesEnforceIdentityFeatureMaskingCSVAndAdminAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	common.RedisEnabled = false
	operation_setting.GetAgentSetting().Enabled = true
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Log{}, &model.AgentAccount{}, &model.AgentCreditLog{},
		&model.SubscriptionPlan{}, &model.AgentPurchaseOrder{}, &model.Redemption{},
	))
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.RedisEnabled = originalRedisEnabled
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	users := []model.User{
		{Id: 71, Username: "query-owner", AffCode: "query-owner-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 72, Username: "query-other", AffCode: "query-other-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 73, Username: "query-disabled", AffCode: "query-disabled-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 74, Username: "query-non-agent", AffCode: "query-non-agent-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 75, Username: "query-admin", AffCode: "query-admin-aff", Role: common.RoleAdminUser, Status: common.UserStatusEnabled},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&[]model.AgentAccount{
		{UserId: 71, Status: model.AgentAccountStatusActive},
		{UserId: 72, Status: model.AgentAccountStatusActive},
		{UserId: 73, Status: model.AgentAccountStatusDisabled},
	}).Error)
	plan := model.SubscriptionPlan{Title: "查询套餐", Enabled: true}
	require.NoError(t, db.Create(&plan).Error)
	now := time.Now().Unix()
	orders := []model.AgentPurchaseOrder{
		{OrderNo: "owner-order", AgentUserId: 71, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 1, UnitPrice: 6000, TotalPrice: 6000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "owner-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 30},
		{OrderNo: "other-order", AgentUserId: 72, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 1, UnitPrice: 7000, TotalPrice: 7000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "other-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 20},
		{OrderNo: "disabled-order", AgentUserId: 73, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 2, UnitPrice: 8000, TotalPrice: 16000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "disabled-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 10},
	}
	require.NoError(t, db.Create(&orders).Error)
	codes := []model.Redemption{
		{UserId: 71, AgentUserId: 71, AgentOrderId: orders[0].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "owner-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 30, ExpiredTime: now + 3600},
		{UserId: 72, AgentUserId: 72, AgentOrderId: orders[1].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "other-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 20, ExpiredTime: now + 3600},
		{UserId: 73, AgentUserId: 73, AgentOrderId: orders[2].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "disabled-fresh-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 10, ExpiredTime: now + 3600},
		{UserId: 73, AgentUserId: 73, AgentOrderId: orders[2].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "disabled-used-history", Name: plan.Title, Status: common.RedemptionCodeStatusUsed, CreatedTime: now - 9, ExpiredTime: now + 3600, RedeemedTime: now - 1, UsedUserId: 74},
	}
	require.NoError(t, db.Create(&codes).Error)
	require.NoError(t, db.Create(&[]model.AgentCreditLog{
		{AgentUserId: 71, Delta: -6000, BalanceBefore: 10000, BalanceAfter: 4000, EventType: model.AgentCreditEventPurchase, BusinessKey: "route-owner-ledger", OrderId: orders[0].Id},
		{AgentUserId: 72, Delta: -7000, BalanceBefore: 10000, BalanceAfter: 3000, EventType: model.AgentCreditEventPurchase, BusinessKey: "route-other-ledger", OrderId: orders[1].Id},
	}).Error)

	usersByID := make(map[int]model.User, len(users))
	for _, user := range users {
		usersByID[user.Id] = user
	}
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("agent-query-route-test"))))
	engine.GET("/test/login/:id", func(c *gin.Context) {
		userID, parseErr := strconv.Atoi(c.Param("id"))
		require.NoError(t, parseErr)
		user := usersByID[userID]
		session := sessions.Default(c)
		session.Set("username", user.Username)
		session.Set("role", user.Role)
		session.Set("id", user.Id)
		session.Set("status", user.Status)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	login := func(userID int) []*http.Cookie {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/test/login/"+strconv.Itoa(userID), nil))
		require.Equal(t, http.StatusNoContent, recorder.Code)
		return recorder.Result().Cookies()
	}
	request := func(cookies []*http.Cookie, userID int, target string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.Header.Set("New-Api-User", strconv.Itoa(userID))
		for _, sessionCookie := range cookies {
			req.AddCookie(sessionCookie)
		}
		engine.ServeHTTP(recorder, req)
		return recorder
	}
	type apiResult struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	assertAPIFailure := func(recorder *httptest.ResponseRecorder) {
		var response apiResult
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
		assert.False(t, response.Success, recorder.Body.String())
	}

	ownerCookies := login(71)
	ownerCodes := request(ownerCookies, 71, "/api/agent/codes?agent_user_id=72")
	var ownerResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Total int `json:"total"`
			Items []struct {
				Code        string `json:"code"`
				AgentUserID int    `json:"agent_user_id"`
				CodeVisible bool   `json:"code_visible"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(ownerCodes.Body.Bytes(), &ownerResponse))
	require.True(t, ownerResponse.Success, ownerCodes.Body.String())
	require.Len(t, ownerResponse.Data.Items, 1)
	assert.Equal(t, 71, ownerResponse.Data.Items[0].AgentUserID)
	assert.Equal(t, "owner-secret", ownerResponse.Data.Items[0].Code)
	assert.True(t, ownerResponse.Data.Items[0].CodeVisible)
	assert.NotContains(t, ownerCodes.Body.String(), "other-secret")

	mismatchedIdentity := request(ownerCookies, 72, "/api/agent/codes")
	assert.Equal(t, http.StatusUnauthorized, mismatchedIdentity.Code)

	for _, target := range []string{
		"/api/agent/orders?p=0",
		"/api/agent/codes?plan_id=0",
		"/api/agent/codes?order_id=-1",
		"/api/agent/codes?start_timestamp=-1",
		"/api/agent/codes?start_timestamp=20&end_timestamp=10",
		"/api/agent/codes?status=invalid",
	} {
		assertAPIFailure(request(ownerCookies, 71, target))
	}

	nonAgentCookies := login(74)
	assertAPIFailure(request(nonAgentCookies, 74, "/api/agent/codes"))
	assertAPIFailure(request(nonAgentCookies, 74, "/api/agent-admin/codes"))

	disabledCookies := login(73)
	disabledCodes := request(disabledCookies, 73, "/api/agent/codes?page_size=100")
	var disabledResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Items []struct {
				Code        string `json:"code"`
				Status      string `json:"status"`
				CodeVisible bool   `json:"code_visible"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(disabledCodes.Body.Bytes(), &disabledResponse))
	require.True(t, disabledResponse.Success, disabledCodes.Body.String())
	require.Len(t, disabledResponse.Data.Items, 2)
	assert.NotContains(t, disabledCodes.Body.String(), "disabled-fresh-secret")
	for _, item := range disabledResponse.Data.Items {
		if item.Status == "unused" {
			assert.Empty(t, item.Code)
			assert.False(t, item.CodeVisible)
		}
	}
	assertAPIFailure(request(disabledCookies, 73, "/api/agent/codes/export"))

	export := request(ownerCookies, 71, "/api/agent/codes/export")
	assert.Equal(t, "text/csv; charset=utf-8", export.Header().Get("Content-Type"))
	assert.Regexp(t, `^attachment; filename="agent-codes-[0-9]{8}-[0-9]{6}\.csv"$`, export.Header().Get("Content-Disposition"))
	assert.Equal(t, "no-store", export.Header().Get("Cache-Control"))
	records, err := csv.NewReader(strings.NewReader(export.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, []string{"code", "plan", "order_no", "status", "created_at", "expired_at", "redeemed_at"}, records[0])
	assert.Equal(t, "owner-secret", records[1][0])
	assert.Len(t, records[1], 7)
	assert.NotContains(t, export.Body.String(), "other-secret")

	operation_setting.GetAgentSetting().Enabled = false
	for _, target := range []string{
		"/api/agent/orders", "/api/agent/codes", "/api/agent/codes/export", "/api/agent/credit-logs",
	} {
		assertAPIFailure(request(ownerCookies, 71, target))
	}
	adminCookies := login(75)
	adminCodes := request(adminCookies, 75, "/api/agent-admin/codes?agent_user_id=71")
	var adminResponse apiResult
	require.NoError(t, common.Unmarshal(adminCodes.Body.Bytes(), &adminResponse))
	assert.True(t, adminResponse.Success, adminCodes.Body.String())
}
