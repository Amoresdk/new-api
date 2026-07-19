package service

import (
	"bytes"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type agentQueryFixture struct {
	now      int64
	agentOne int
	agentTwo int
	planOne  model.SubscriptionPlan
	planTwo  model.SubscriptionPlan
	orderOne model.AgentPurchaseOrder
	orderTwo model.AgentPurchaseOrder
}

func setupAgentQueryTest(t *testing.T) agentQueryFixture {
	t.Helper()
	originalDB := model.DB
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-query.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.SubscriptionPlan{}, &model.AgentAccount{},
		&model.AgentPurchaseOrder{}, &model.Redemption{}, &model.AgentCreditLog{},
	))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		sqlDB, dbErr := db.DB()
		require.NoError(t, dbErr)
		require.NoError(t, sqlDB.Close())
	})

	const agentOne = 61
	const agentTwo = 62
	for _, userID := range []int{agentOne, agentTwo} {
		require.NoError(t, db.Create(&model.User{
			Id: userID, Username: fmt.Sprintf("query-agent-%d", userID),
			AffCode: fmt.Sprintf("query-aff-%d", userID), Status: common.UserStatusEnabled,
		}).Error)
		require.NoError(t, db.Create(&model.AgentAccount{
			UserId: userID, Status: model.AgentAccountStatusActive,
		}).Error)
	}

	planOne := model.SubscriptionPlan{Title: "月度专业版", Enabled: true}
	planTwo := model.SubscriptionPlan{Title: "=Admin Formula", Enabled: true}
	require.NoError(t, db.Create(&planOne).Error)
	require.NoError(t, db.Create(&planTwo).Error)
	now := time.Now().Unix()
	orderOne := model.AgentPurchaseOrder{
		OrderNo: "order-agent-one", AgentUserId: agentOne, PlanId: planOne.Id,
		PlanTitle: planOne.Title, Quantity: 4, UnitPrice: 6000, TotalPrice: 24000,
		CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}",
		IdempotencyKey: "query-order-one", Status: model.AgentPurchaseOrderStatusCompleted,
		CreatedAt: now - 100,
	}
	orderTwo := model.AgentPurchaseOrder{
		OrderNo: "@other-order", AgentUserId: agentTwo, PlanId: planTwo.Id,
		PlanTitle: planTwo.Title, Quantity: 1, UnitPrice: 9000, TotalPrice: 9000,
		CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}",
		IdempotencyKey: "query-order-two", Status: model.AgentPurchaseOrderStatusCompleted,
		CreatedAt: now - 50,
	}
	require.NoError(t, db.Create(&orderOne).Error)
	require.NoError(t, db.Create(&orderTwo).Error)

	codes := []model.Redemption{
		{UserId: agentOne, AgentUserId: agentOne, AgentOrderId: orderOne.Id, SubscriptionPlanId: planOne.Id, Type: common.RedemptionCodeTypeSubscription, Key: "unused-code", Name: planOne.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 90, ExpiredTime: now + 3600},
		{UserId: agentOne, AgentUserId: agentOne, AgentOrderId: orderOne.Id, SubscriptionPlanId: planOne.Id, Type: common.RedemptionCodeTypeSubscription, Key: "+used-code", Name: planOne.Title, Status: common.RedemptionCodeStatusUsed, CreatedTime: now - 80, ExpiredTime: now + 3600, RedeemedTime: now - 10, UsedUserId: 77},
		{UserId: agentOne, AgentUserId: agentOne, AgentOrderId: orderOne.Id, SubscriptionPlanId: planOne.Id, Type: common.RedemptionCodeTypeSubscription, Key: "-refunded-code", Name: planOne.Title, Status: common.RedemptionCodeStatusRefunded, CreatedTime: now - 70, ExpiredTime: now + 3600},
		{UserId: agentOne, AgentUserId: agentOne, AgentOrderId: orderOne.Id, SubscriptionPlanId: planOne.Id, Type: common.RedemptionCodeTypeSubscription, Key: "=expired-code", Name: planOne.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 60, ExpiredTime: now - 1},
		{UserId: agentTwo, AgentUserId: agentTwo, AgentOrderId: orderTwo.Id, SubscriptionPlanId: planTwo.Id, Type: common.RedemptionCodeTypeSubscription, Key: "@other-code", Name: planTwo.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 40, ExpiredTime: now + 3600},
	}
	require.NoError(t, db.Create(&codes).Error)
	logs := []model.AgentCreditLog{
		{AgentUserId: agentOne, Delta: -24000, BalanceBefore: 50000, BalanceAfter: 26000, EventType: model.AgentCreditEventPurchase, BusinessKey: "query-log-one", OrderId: orderOne.Id, CreatedAt: now - 90},
		{AgentUserId: agentTwo, Delta: -9000, BalanceBefore: 10000, BalanceAfter: 1000, EventType: model.AgentCreditEventPurchase, BusinessKey: "query-log-two", OrderId: orderTwo.Id, CreatedAt: now - 40},
	}
	require.NoError(t, db.Create(&logs).Error)

	return agentQueryFixture{now: now, agentOne: agentOne, agentTwo: agentTwo, planOne: planOne, planTwo: planTwo, orderOne: orderOne, orderTwo: orderTwo}
}

func TestListAgentQueriesEnforceOwnershipTotalsMoneyAndDisplayStatus(t *testing.T) {
	fixture := setupAgentQueryTest(t)

	orders, total, err := ListAgentOrders(fixture.agentOne, AgentOrderQuery{
		AgentUserID: fixture.agentTwo, Offset: 0, Limit: 1,
	})
	require.NoError(t, err)
	require.Len(t, orders, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, fixture.agentOne, orders[0].AgentUserID)
	assert.Equal(t, "60.00", orders[0].UnitPrice)
	assert.Equal(t, "240.00", orders[0].TotalPrice)
	orderJSON, err := common.Marshal(orders[0])
	require.NoError(t, err)
	assert.Contains(t, string(orderJSON), `"unit_price":"60.00"`)
	assert.Contains(t, string(orderJSON), `"total_price":"240.00"`)
	assert.NotContains(t, string(orderJSON), `"unit_price":6000`)
	assert.NotContains(t, string(orderJSON), `"total_price":24000`)

	codes, total, err := ListAgentCodes(fixture.agentOne, AgentCodeQuery{
		AgentUserID: fixture.agentTwo, Offset: 0, Limit: 2, Now: fixture.now,
	})
	require.NoError(t, err)
	require.Len(t, codes, 2)
	assert.Equal(t, int64(4), total, "total must be independent of pagination")
	for _, code := range codes {
		assert.Equal(t, fixture.agentOne, code.AgentUserID)
		assert.NotEqual(t, "@other-code", code.Code)
	}

	wantStatuses := map[string]string{
		"unused-code": "unused", "+used-code": "used",
		"-refunded-code": "refunded", "=expired-code": "expired",
	}
	allCodes, total, err := ListAgentCodes(fixture.agentOne, AgentCodeQuery{Limit: 100, Now: fixture.now})
	require.NoError(t, err)
	assert.Equal(t, int64(4), total)
	require.Len(t, allCodes, 4)
	for _, code := range allCodes {
		assert.Equal(t, wantStatuses[code.Code], code.Status)
	}

	for _, status := range []string{"unused", "used", "refunded", "expired"} {
		filtered, filteredTotal, filterErr := ListAgentCodes(fixture.agentOne, AgentCodeQuery{
			Status: status, Limit: 100, Now: fixture.now,
		})
		require.NoError(t, filterErr)
		assert.Equal(t, int64(1), filteredTotal)
		if assert.Len(t, filtered, 1) {
			assert.Equal(t, status, filtered[0].Status)
		}
	}

	logs, total, err := ListAgentCreditLogs(fixture.agentOne, AgentCreditLogQuery{
		AgentUserID: fixture.agentTwo, Limit: 100,
	})
	require.NoError(t, err)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, fixture.agentOne, logs[0].AgentUserID)
	assert.Equal(t, "-240.00", logs[0].Delta)
	assert.Equal(t, "500.00", logs[0].BalanceBefore)
	assert.Equal(t, "260.00", logs[0].BalanceAfter)
	logJSON, err := common.Marshal(logs[0])
	require.NoError(t, err)
	assert.Contains(t, string(logJSON), `"delta":"-240.00"`)
	assert.NotContains(t, string(logJSON), `"delta":-24000`)

	_, _, err = ListAgentCodes(fixture.agentOne, AgentCodeQuery{Limit: 101})
	require.NoError(t, err, "service should safely cap ordinary pages")
}

func TestListAgentAdminQueriesSupportFiltersAndStrictValidation(t *testing.T) {
	fixture := setupAgentQueryTest(t)

	orders, total, err := ListAdminAgentOrders(AgentOrderQuery{
		AgentUserID: fixture.agentTwo, PlanID: fixture.planTwo.Id, Limit: 100,
	})
	require.NoError(t, err)
	require.Len(t, orders, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, fixture.agentTwo, orders[0].AgentUserID)

	codes, total, err := ListAdminAgentCodes(AgentCodeQuery{
		AgentUserID: fixture.agentTwo, Status: "unused", StartTimestamp: fixture.now - 100,
		EndTimestamp: fixture.now, Limit: 100, Now: fixture.now,
	})
	require.NoError(t, err)
	require.Len(t, codes, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, "@other-code", codes[0].Code)

	_, _, err = ListAdminAgentCodes(AgentCodeQuery{Status: "unknown", Limit: 10})
	assert.ErrorIs(t, err, ErrAgentQueryInvalid)
	_, _, err = ListAdminAgentOrders(AgentOrderQuery{StartTimestamp: 10, EndTimestamp: 9, Limit: 10})
	assert.ErrorIs(t, err, ErrAgentQueryInvalid)
}

func TestExportAgentCodesScopesOwnerEscapesFormulaAndUsesStableUTF8Columns(t *testing.T) {
	fixture := setupAgentQueryTest(t)
	var output bytes.Buffer

	err := ExportAgentCodes(&output, AgentCodeQuery{
		AgentUserID: fixture.agentOne, Limit: AgentCodeExportMaxRows, Now: fixture.now,
	})
	require.NoError(t, err)
	csvText := output.String()
	assert.True(t, strings.HasPrefix(csvText, "code,plan,order_no,status,created_at,expired_at,redeemed_at\n"))
	assert.Contains(t, csvText, "月度专业版")
	assert.Contains(t, csvText, "'+used-code")
	assert.Contains(t, csvText, "'-refunded-code")
	assert.Contains(t, csvText, "'=expired-code")
	assert.NotContains(t, csvText, "@other-code")
	assert.NotContains(t, csvText, "@other-order")

	var otherOutput bytes.Buffer
	err = ExportAgentCodes(&otherOutput, AgentCodeQuery{
		AgentUserID: fixture.agentTwo, Limit: AgentCodeExportMaxRows, Now: fixture.now,
	})
	require.NoError(t, err)
	assert.Contains(t, otherOutput.String(), "'@other-code")
	assert.Contains(t, otherOutput.String(), "'=Admin Formula")
	assert.Contains(t, otherOutput.String(), "'@other-order")
}

func TestExportAgentCodesRejectsDisabledAgentAndMaximumOverflowBeforeWriting(t *testing.T) {
	fixture := setupAgentQueryTest(t)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).
		Where("user_id = ?", fixture.agentOne).Update("status", model.AgentAccountStatusDisabled).Error)

	var disabled bytes.Buffer
	err := ExportAgentCodes(&disabled, AgentCodeQuery{AgentUserID: fixture.agentOne, Now: fixture.now})
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
	assert.Zero(t, disabled.Len())
	history, total, err := ListAgentCodes(fixture.agentOne, AgentCodeQuery{Limit: 100, Now: fixture.now})
	require.NoError(t, err, "disabled agents retain read-only access to sold inventory history")
	assert.Equal(t, int64(4), total)
	assert.Len(t, history, 4)

	require.NoError(t, model.DB.Model(&model.AgentAccount{}).
		Where("user_id = ?", fixture.agentOne).Update("status", model.AgentAccountStatusActive).Error)
	bulk := make([]model.Redemption, 0, AgentCodeExportMaxRows)
	for index := 0; index < AgentCodeExportMaxRows; index++ {
		bulk = append(bulk, model.Redemption{
			UserId: fixture.agentOne, AgentUserId: fixture.agentOne,
			AgentOrderId: fixture.orderOne.Id, SubscriptionPlanId: fixture.planOne.Id,
			Type: common.RedemptionCodeTypeSubscription, Key: fmt.Sprintf("bulk-%08d", index),
			Name: fixture.planOne.Title, Status: common.RedemptionCodeStatusEnabled,
			CreatedTime: fixture.now, ExpiredTime: fixture.now + 3600,
		})
	}
	require.NoError(t, model.DB.CreateInBatches(&bulk, 250).Error)

	var overflow bytes.Buffer
	err = ExportAgentCodes(&overflow, AgentCodeQuery{AgentUserID: fixture.agentOne, Now: fixture.now})
	assert.True(t, errors.Is(err, ErrAgentExportLimitExceeded))
	assert.Zero(t, overflow.Len(), "export must fail before emitting a partial file")
}
