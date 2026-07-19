package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionEntitlementVersionOneRoundTrip(t *testing.T) {
	plan := &SubscriptionPlan{
		Id:                      7101,
		Title:                   "Annual Pro",
		DurationUnit:            SubscriptionDurationYear,
		DurationValue:           1,
		CustomSeconds:           0,
		MaxPurchasePerUser:      4,
		UpgradeGroup:            "pro",
		DowngradeGroup:          "default",
		TotalAmount:             5000,
		QuotaResetPeriod:        SubscriptionResetMonthly,
		QuotaResetCustomSeconds: 0,
		AllowWalletOverflow:     nil,
	}

	snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	assert.Equal(t, SubscriptionEntitlementVersion1, snapshot.Version)
	assert.True(t, snapshot.AllowWalletOverflow)

	raw, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)
	assert.JSONEq(t, `{
		"version": 1,
		"plan_id": 7101,
		"plan_title": "Annual Pro",
		"duration_unit": "year",
		"duration_value": 1,
		"custom_seconds": 0,
		"max_purchase_per_user": 4,
		"upgrade_group": "pro",
		"downgrade_group": "default",
		"total_amount": 5000,
		"quota_reset_period": "monthly",
		"quota_reset_custom_seconds": 0,
		"allow_wallet_overflow": true
	}`, raw)

	plan.DurationValue = 12
	plan.TotalAmount = 1
	plan.AllowWalletOverflow = common.GetPointer(false)

	decoded, err := DecodeSubscriptionEntitlementSnapshot(raw)
	require.NoError(t, err)
	assert.Equal(t, snapshot, decoded)
	assert.Equal(t, 1, decoded.DurationValue)
	assert.Equal(t, int64(5000), decoded.TotalAmount)
}

func TestSubscriptionEntitlementRejectsUnknownVersion(t *testing.T) {
	_, err := DecodeSubscriptionEntitlementSnapshot(`{"version":2,"plan_id":1}`)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "version")

	_, err = EncodeSubscriptionEntitlementSnapshot(SubscriptionEntitlementSnapshot{
		Version: 2,
		PlanId:  1,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "version")
}

func TestSubscriptionEntitlementDeliveryUsesImmutableSnapshot(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       7201,
		Username: "snapshot_user",
		Status:   common.UserStatusEnabled,
		Group:    "starter",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Id:                      7202,
		Title:                   "Snapshot Plan",
		DurationUnit:            SubscriptionDurationCustom,
		CustomSeconds:           7200,
		MaxPurchasePerUser:      2,
		UpgradeGroup:            "pro",
		DowngradeGroup:          "starter",
		TotalAmount:             5000,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 1800,
		AllowWalletOverflow:     common.GetPointer(false),
	}
	snapshot, err := BuildSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	raw, err := EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)

	plan.DurationUnit = SubscriptionDurationMonth
	plan.DurationValue = 12
	plan.CustomSeconds = 0
	plan.MaxPurchasePerUser = 0
	plan.UpgradeGroup = "enterprise"
	plan.DowngradeGroup = "default"
	plan.TotalAmount = 1
	plan.QuotaResetPeriod = SubscriptionResetNever
	plan.QuotaResetCustomSeconds = 0
	plan.AllowWalletOverflow = common.GetPointer(true)

	decoded, err := DecodeSubscriptionEntitlementSnapshot(raw)
	require.NoError(t, err)
	var first *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		first, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.NoError(t, err)
		_, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.NoError(t, err)
		_, err = CreateUserSubscriptionFromEntitlementTx(tx, user.Id, decoded, "redemption")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "购买上限")
		return nil
	}))

	require.NotNil(t, first)
	assert.Equal(t, snapshot.PlanId, first.PlanId)
	assert.Equal(t, int64(5000), first.AmountTotal)
	assert.Zero(t, first.AmountUsed)
	assert.Equal(t, int64(7200), first.EndTime-first.StartTime)
	assert.Equal(t, first.StartTime, first.LastResetTime)
	assert.Equal(t, int64(1800), first.NextResetTime-first.StartTime)
	assert.Equal(t, "redemption", first.Source)
	assert.Equal(t, "pro", first.UpgradeGroup)
	assert.Equal(t, "starter", first.PrevUserGroup)
	assert.Equal(t, "starter", first.DowngradeGroup)
	assert.False(t, first.AllowWalletOverflow)

	var reloadedUser User
	require.NoError(t, DB.Select("group").First(&reloadedUser, user.Id).Error)
	assert.Equal(t, "pro", reloadedUser.Group)
}
