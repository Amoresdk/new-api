package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	RedemptionResultTypeQuota        = "quota"
	RedemptionResultTypeSubscription = "subscription"
)

var ErrRedeemCodeFailed = errors.New("redemption failed")

type RedemptionResult struct {
	Type           string `json:"type"`
	Quota          *int   `json:"quota,omitempty"`
	SubscriptionID int    `json:"subscription_id,omitempty"`
	PlanTitle      string `json:"plan_title,omitempty"`
	EndTime        int64  `json:"end_time,omitempty"`
}

// RedeemCode dispatches legacy quota codes to the existing redemption path and
// delivers agent package codes from their immutable purchase snapshot.
func RedeemCode(userID int, key string) (*RedemptionResult, error) {
	if userID <= 0 || key == "" {
		return nil, redeemCodeError(errors.New("invalid redemption request"))
	}

	var codeType struct {
		Type int
	}
	if err := model.DB.Model(&model.Redemption{}).
		Select("type").
		Where(&model.Redemption{Key: key}).
		Take(&codeType).Error; err != nil {
		return nil, redeemCodeError(err)
	}

	switch codeType.Type {
	case common.RedemptionCodeTypeQuota:
		quota, err := model.Redeem(key, userID)
		if err != nil {
			return nil, redeemCodeError(err)
		}
		return &RedemptionResult{Type: RedemptionResultTypeQuota, Quota: &quota}, nil
	case common.RedemptionCodeTypeSubscription:
		return redeemSubscriptionCode(userID, key)
	default:
		return nil, redeemCodeError(errors.New("unsupported redemption code type"))
	}
}

func redeemSubscriptionCode(userID int, key string) (*RedemptionResult, error) {
	now := common.GetTimestamp()
	var result RedemptionResult
	var redeemedCode model.Redemption
	var snapshot model.SubscriptionEntitlementSnapshot

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		updated := tx.Model(&model.Redemption{}).
			Where(&model.Redemption{
				Key: key, Type: common.RedemptionCodeTypeSubscription,
				Status: common.RedemptionCodeStatusEnabled,
			}).
			Where("expired_time > ?", now).
			Updates(map[string]interface{}{
				"status":        common.RedemptionCodeStatusUsed,
				"redeemed_time": now,
				"used_user_id":  userID,
			})
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return errors.New("subscription redemption code is unavailable")
		}

		if err := tx.Where(&model.Redemption{
			Key: key, Type: common.RedemptionCodeTypeSubscription,
			Status: common.RedemptionCodeStatusUsed, UsedUserId: userID,
		}).First(&redeemedCode).Error; err != nil {
			return err
		}
		var user model.User
		if err := tx.Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		var order model.AgentPurchaseOrder
		if err := tx.First(&order, redeemedCode.AgentOrderId).Error; err != nil {
			return err
		}
		if order.Status != model.AgentPurchaseOrderStatusCompleted && order.Status != model.AgentPurchaseOrderStatusPartiallyRefunded {
			return errors.New("subscription redemption order is unavailable")
		}
		decoded, err := model.DecodeSubscriptionEntitlementSnapshot(order.EntitlementSnapshot)
		if err != nil {
			return err
		}
		if redeemedCode.AgentOrderId != order.Id ||
			redeemedCode.AgentUserId != order.AgentUserId ||
			redeemedCode.SubscriptionPlanId != order.PlanId ||
			decoded.PlanId != order.PlanId ||
			decoded.PlanTitle != order.PlanTitle ||
			redeemedCode.Name != decoded.PlanTitle {
			return errors.New("subscription redemption snapshot does not match its order")
		}

		subscription, err := model.CreateUserSubscriptionFromEntitlementTx(tx, userID, decoded, "agent_redemption")
		if err != nil {
			return err
		}
		snapshot = decoded
		result = RedemptionResult{
			Type: RedemptionResultTypeSubscription, SubscriptionID: subscription.Id,
			PlanTitle: decoded.PlanTitle, EndTime: subscription.EndTime,
		}
		return nil
	})
	if err != nil {
		return nil, redeemCodeError(err)
	}

	if snapshot.UpgradeGroup != "" {
		_ = model.UpdateUserGroupCache(userID, snapshot.UpgradeGroup)
	}
	model.RecordLog(userID, model.LogTypeTopup,
		fmt.Sprintf("通过代理套餐兑换码激活订阅 %s，兑换码ID %d", snapshot.PlanTitle, redeemedCode.Id))
	return &result, nil
}

func redeemCodeError(cause error) error {
	return fmt.Errorf("%w: %v", ErrRedeemCodeFailed, cause)
}
