package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetAgentOverview(c *gin.Context) {
	overview, err := service.GetAgentOverview(c.GetInt("id"))
	if err != nil {
		writeAgentError(c, err)
		return
	}
	common.ApiSuccess(c, dto.AgentOverviewResponse{
		Status:             overview.Account.Status,
		Balance:            service.FormatAgentPoints(overview.Account.Balance),
		DailyCodeLimit:     overview.Account.DailyCodeLimit,
		DailyCodeCount:     overview.DailyCodeCount,
		DailyRemaining:     overview.DailyRemaining,
		NextDailyResetAt:   overview.NextDailyResetAt,
		AccountLastUpdated: overview.Account.UpdatedAt,
	})
}

func GetAgentOffers(c *gin.Context) {
	records, err := service.ListPurchasableAgentOffers(c.GetInt("id"))
	if err != nil {
		writeAgentError(c, err)
		return
	}
	items := make([]dto.AgentPlanOfferResponse, 0, len(records))
	for _, record := range records {
		items = append(items, agentPlanOfferResponse(record))
	}
	common.ApiSuccess(c, items)
}

func CreateAgentOrder(c *gin.Context) {
	var request dto.AgentPurchaseRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid purchase request")
		return
	}
	result, err := service.PurchaseAgentCodes(service.AgentPurchaseInput{
		AgentUserID: c.GetInt("id"), PlanID: request.PlanId,
		Quantity: request.Quantity, IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}

	codes := make([]dto.AgentPackageCodeResponse, 0, len(result.Codes))
	for _, code := range result.Codes {
		codes = append(codes, dto.AgentPackageCodeResponse{
			Id: code.Id, Key: code.Key, Name: code.Name, Status: code.Status,
			SubscriptionPlanId: code.SubscriptionPlanId,
			CreatedTime:        code.CreatedTime,
			ExpiredTime:        code.ExpiredTime,
		})
	}
	order := result.Order
	common.ApiSuccess(c, dto.AgentPurchaseResponse{
		Order: dto.AgentPurchaseOrderResponse{
			Id: order.Id, OrderNo: order.OrderNo, PlanId: order.PlanId,
			PlanTitle: order.PlanTitle, Quantity: order.Quantity,
			UnitPrice:     service.FormatAgentPoints(order.UnitPrice),
			TotalPrice:    service.FormatAgentPoints(order.TotalPrice),
			CodeValidDays: order.CodeValidDays, RefundFeeBps: order.RefundFeeBps,
			Status: order.Status, CreatedAt: order.CreatedAt,
		},
		Codes:        codes,
		BalanceAfter: service.FormatAgentPoints(result.BalanceAfter),
	})
}

func writeAgentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAgentFeatureDisabled):
		common.ApiErrorMsg(c, "agent workspace is disabled")
	case errors.Is(err, service.ErrAgentAccountNotFound):
		common.ApiErrorMsg(c, "agent account not found")
	case errors.Is(err, service.ErrAgentAccountDisabled):
		common.ApiErrorMsg(c, "agent account is disabled")
	case errors.Is(err, service.ErrAgentPurchaseInvalidQuantity):
		common.ApiErrorMsg(c, "quantity must be between 1 and 100")
	case errors.Is(err, service.ErrAgentPurchaseInvalidRequest):
		common.ApiErrorMsg(c, "plan and idempotency key are required")
	case errors.Is(err, service.ErrAgentOfferUnavailable):
		common.ApiErrorMsg(c, "agent offer is unavailable")
	case errors.Is(err, service.ErrAgentPlanUnavailable):
		common.ApiErrorMsg(c, "subscription plan is unavailable")
	case errors.Is(err, service.ErrAgentInsufficientBalance):
		common.ApiErrorMsg(c, "agent balance is insufficient")
	case errors.Is(err, service.ErrAgentDailyLimitExceeded):
		common.ApiErrorMsg(c, "daily code purchase limit exceeded")
	case errors.Is(err, service.ErrAgentIdempotencyConflict):
		common.ApiErrorMsg(c, "idempotency key was already used for a different purchase")
	case errors.Is(err, service.ErrAgentAccountConflict):
		common.ApiErrorMsg(c, "agent account changed concurrently; please retry")
	default:
		common.SysError("agent purchase failed: " + err.Error())
		common.ApiErrorMsg(c, "agent purchase failed")
	}
}
