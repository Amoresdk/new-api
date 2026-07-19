package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentModels(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(
		&AgentAccount{},
		&AgentCreditLog{},
		&AgentPlanOffer{},
		&AgentPurchaseOrder{},
		&AgentRefundRequest{},
		&Redemption{},
	))

	entities := []interface{}{
		&AgentRefundRequest{},
		&AgentCreditLog{},
		&AgentPurchaseOrder{},
		&AgentPlanOffer{},
		&AgentAccount{},
		&Redemption{},
	}
	for _, entity := range entities {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(entity).Error)
	}
	t.Cleanup(func() {
		for _, entity := range entities {
			require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(entity).Error)
		}
	})

	account := AgentAccount{UserId: 101, Status: AgentAccountStatusActive, Balance: 10000, DailyCodeLimit: 200}
	require.NoError(t, DB.Create(&account).Error)
	assert.Error(t, DB.Create(&AgentAccount{UserId: account.UserId, Status: AgentAccountStatusActive}).Error)

	log := AgentCreditLog{
		AgentUserId:   account.UserId,
		Delta:         10000,
		BalanceBefore: 0,
		BalanceAfter:  10000,
		EventType:     AgentCreditEventAdminCredit,
		BusinessKey:   "credit-101",
	}
	require.NoError(t, DB.Create(&log).Error)
	assert.Error(t, DB.Create(&AgentCreditLog{EventType: log.EventType, BusinessKey: log.BusinessKey}).Error)

	offer := AgentPlanOffer{PlanId: 201, Enabled: true, UnitPrice: 6000, CodeValidDays: 365, RefundFeeBps: 500}
	require.NoError(t, DB.Create(&offer).Error)
	assert.Error(t, DB.Create(&AgentPlanOffer{PlanId: offer.PlanId}).Error)

	order := AgentPurchaseOrder{
		OrderNo:             "AG202607200001",
		AgentUserId:         account.UserId,
		PlanId:              offer.PlanId,
		PlanTitle:           "Starter",
		Quantity:            1,
		UnitPrice:           offer.UnitPrice,
		TotalPrice:          offer.UnitPrice,
		CodeValidDays:       offer.CodeValidDays,
		RefundFeeBps:        offer.RefundFeeBps,
		EntitlementSnapshot: "{\"version\":1}",
		IdempotencyKey:      "purchase-101",
		Status:              AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, DB.Create(&order).Error)
	assert.Error(t, DB.Create(&AgentPurchaseOrder{OrderNo: order.OrderNo, AgentUserId: 102, IdempotencyKey: "purchase-102"}).Error)
	assert.Error(t, DB.Create(&AgentPurchaseOrder{OrderNo: "AG202607200002", AgentUserId: order.AgentUserId, IdempotencyKey: order.IdempotencyKey}).Error)

	refund := AgentRefundRequest{
		AgentUserId:           account.UserId,
		IdempotencyKey:        "refund-101",
		RequestHash:           "request-hash-101",
		RedemptionIDsSnapshot: "[1]",
		FeeTotal:              300,
		RefundTotal:           5700,
		BalanceAfter:          15700,
	}
	require.NoError(t, DB.Create(&refund).Error)
	assert.Error(t, DB.Create(&AgentRefundRequest{AgentUserId: refund.AgentUserId, IdempotencyKey: refund.IdempotencyKey}).Error)

	legacy := Redemption{Key: "00000000000000000000000000000001", Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, DB.Create(&legacy).Error)
	var loaded Redemption
	require.NoError(t, DB.First(&loaded, legacy.Id).Error)
	assert.Equal(t, common.RedemptionCodeTypeQuota, loaded.Type)
}
