package dto

type AgentDailyLimitRequest struct {
	DailyCodeLimit int `json:"daily_code_limit"`
}

type AgentCreditAdjustmentRequest struct {
	Amount         string `json:"amount"`
	Direction      string `json:"direction"`
	Reason         string `json:"reason"`
	IdempotencyKey string `json:"idempotency_key"`
}

type AgentAccountResponse struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id"`
	Username       string `json:"username,omitempty"`
	DisplayName    string `json:"display_name,omitempty"`
	Status         string `json:"status"`
	Balance        string `json:"balance"`
	DailyCodeLimit int    `json:"daily_code_limit"`
	DailyCountDate string `json:"daily_count_date"`
	DailyCodeCount int    `json:"daily_code_count"`
	Version        int64  `json:"version"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type AgentCreditLogResponse struct {
	Id             int    `json:"id"`
	AgentUserId    int    `json:"agent_user_id"`
	Delta          string `json:"delta"`
	BalanceBefore  string `json:"balance_before"`
	BalanceAfter   string `json:"balance_after"`
	EventType      string `json:"event_type"`
	BusinessKey    string `json:"business_key"`
	OrderId        int    `json:"order_id"`
	RedemptionId   int    `json:"redemption_id"`
	OperatorUserId int    `json:"operator_user_id"`
	Remark         string `json:"remark"`
	CreatedAt      int64  `json:"created_at"`
}

type AgentCreditAdjustmentResponse struct {
	Account AgentCreditBalanceResponse `json:"account"`
	Log     AgentCreditLogResponse     `json:"log"`
}

type AgentCreditBalanceResponse struct {
	Balance string `json:"balance"`
}
