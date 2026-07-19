package model

// AgentPlanOffer configures the purchase terms for one subscription plan.
type AgentPlanOffer struct {
	Id            int   `json:"id"`
	PlanId        int   `json:"plan_id" gorm:"uniqueIndex;not null"`
	Enabled       bool  `json:"enabled" gorm:"not null"`
	UnitPrice     int64 `json:"unit_price" gorm:"type:bigint;not null"`
	CodeValidDays int   `json:"code_valid_days" gorm:"type:int;not null;default:365"`
	RefundFeeBps  int   `json:"refund_fee_bps" gorm:"type:int;not null"`
	CreatedAt     int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64 `json:"updated_at" gorm:"autoUpdateTime"`
}
