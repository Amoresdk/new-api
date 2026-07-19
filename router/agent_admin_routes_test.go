package router

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentAdminRoutesUseAdminReadsAndRootMutations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = originalRedisEnabled })
	originalDB, originalLogDB := model.DB, model.LOG_DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Log{}, &model.AgentAccount{}, &model.AgentCreditLog{},
		&model.SubscriptionPlan{}, &model.AgentPlanOffer{},
	))
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() { model.DB, model.LOG_DB = originalDB, originalLogDB })
	require.NoError(t, db.Create(&model.User{
		Id: 1, Username: "admin", AffCode: "admin-aff",
		Role: common.RoleAdminUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.User{
		Id: 2, Username: "agent", AffCode: "agent-aff",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.User{
		Id: 3, Username: "root", AffCode: "root-aff",
		Role: common.RoleRootUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{
		UserId: 2, Status: model.AgentAccountStatusActive,
		DailyCodeLimit: model.DefaultAgentDailyCodeLimit,
	}).Error)
	plan := model.SubscriptionPlan{
		Title: "Monthly", Currency: "USD", DurationUnit: model.SubscriptionDurationMonth,
		DurationValue: 1, Enabled: true,
	}
	require.NoError(t, db.Create(&plan).Error)

	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("agent-admin-route-test"))))
	engine.GET("/test/admin-login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "admin")
		session.Set("role", common.RoleAdminUser)
		session.Set("id", 1)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	engine.GET("/test/root-login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "root")
		session.Set("role", common.RoleRootUser)
		session.Set("id", 3)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/test/admin-login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)
	cookies := loginRecorder.Result().Cookies()
	require.NotEmpty(t, cookies)

	readRecorder := httptest.NewRecorder()
	readRequest := httptest.NewRequest(http.MethodGet, "/api/agent-admin/agents", nil)
	readRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		readRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(readRecorder, readRequest)
	var readResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(readRecorder.Body.Bytes(), &readResponse))
	assert.True(t, readResponse.Success, readRecorder.Body.String())

	offerReadRecorder := httptest.NewRecorder()
	offerReadRequest := httptest.NewRequest(http.MethodGet, "/api/agent-admin/offers", nil)
	offerReadRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		offerReadRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(offerReadRecorder, offerReadRequest)
	var offerReadResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(offerReadRecorder.Body.Bytes(), &offerReadResponse))
	assert.True(t, offerReadResponse.Success, offerReadRecorder.Body.String())

	offerMutationRecorder := httptest.NewRecorder()
	offerMutationRequest := httptest.NewRequest(http.MethodPut, "/api/agent-admin/offers/"+strconv.Itoa(plan.Id),
		strings.NewReader(`{"enabled":true,"unit_price":"60.00","refund_fee_bps":500}`))
	offerMutationRequest.Header.Set("Content-Type", "application/json")
	offerMutationRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		offerMutationRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(offerMutationRecorder, offerMutationRequest)
	var offerMutationResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(offerMutationRecorder.Body.Bytes(), &offerMutationResponse))
	assert.False(t, offerMutationResponse.Success, offerMutationRecorder.Body.String())
	var offerCount int64
	require.NoError(t, db.Model(&model.AgentPlanOffer{}).Count(&offerCount).Error)
	assert.Zero(t, offerCount)

	rootLoginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(rootLoginRecorder, httptest.NewRequest(http.MethodGet, "/test/root-login", nil))
	require.Equal(t, http.StatusNoContent, rootLoginRecorder.Code)
	rootCookies := rootLoginRecorder.Result().Cookies()
	require.NotEmpty(t, rootCookies)

	rootMutationRecorder := httptest.NewRecorder()
	rootMutationRequest := httptest.NewRequest(http.MethodPut, "/api/agent-admin/offers/"+strconv.Itoa(plan.Id),
		strings.NewReader(`{"enabled":true,"unit_price":"60.00","refund_fee_bps":500}`))
	rootMutationRequest.Header.Set("Content-Type", "application/json")
	rootMutationRequest.Header.Set("New-Api-User", "3")
	for _, sessionCookie := range rootCookies {
		rootMutationRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(rootMutationRecorder, rootMutationRequest)
	var rootMutationResponse struct {
		Success bool `json:"success"`
		Data    struct {
			UnitPrice     string `json:"unit_price"`
			CodeValidDays int    `json:"code_valid_days"`
			Plan          struct {
				Id    int    `json:"id"`
				Title string `json:"title"`
			} `json:"plan"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rootMutationRecorder.Body.Bytes(), &rootMutationResponse))
	require.True(t, rootMutationResponse.Success, rootMutationRecorder.Body.String())
	assert.Equal(t, "60.00", rootMutationResponse.Data.UnitPrice)
	assert.Equal(t, model.DefaultAgentCodeValidDays, rootMutationResponse.Data.CodeValidDays)
	assert.Equal(t, plan.Id, rootMutationResponse.Data.Plan.Id)
	assert.Equal(t, plan.Title, rootMutationResponse.Data.Plan.Title)
	require.NoError(t, db.Model(&model.AgentPlanOffer{}).Count(&offerCount).Error)
	assert.Equal(t, int64(1), offerCount)

	var auditLog model.Log
	require.NoError(t, db.Where("user_id = ? AND type = ?", 3, model.LogTypeManage).Last(&auditLog).Error)
	assert.Contains(t, auditLog.Other, `"action":"agent.offer_update"`)
	assert.Contains(t, auditLog.Other, `"plan_id":`+strconv.Itoa(plan.Id))
	assert.Contains(t, auditLog.Other, `"unit_price":"60.00"`)
	assert.Contains(t, auditLog.Other, `"code_valid_days":365`)
	assert.Contains(t, auditLog.Other, `"refund_fee_bps":500`)

	mutationRecorder := httptest.NewRecorder()
	mutationRequest := httptest.NewRequest(http.MethodPost, "/api/agent-admin/agents/2/disable", nil)
	mutationRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		mutationRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(mutationRecorder, mutationRequest)
	var mutationResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(mutationRecorder.Body.Bytes(), &mutationResponse))
	assert.False(t, mutationResponse.Success, mutationRecorder.Body.String())

	var account model.AgentAccount
	require.NoError(t, db.Where("user_id = ?", 2).First(&account).Error)
	assert.Equal(t, model.AgentAccountStatusActive, account.Status)
}
