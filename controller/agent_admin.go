package controller

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func AdminListAgents(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	records, total, err := service.ListAdminAgentAccounts(
		c.Query("keyword"),
		c.Query("status"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	items := make([]dto.AgentAccountResponse, 0, len(records))
	for _, record := range records {
		items = append(items, agentAccountResponse(record.Account, record.Username, record.DisplayName))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminListAgentCreditLogs(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	pageInfo := common.GetPageQuery(c)
	logs, total, err := service.ListAdminAgentCreditLogs(userID, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	items := make([]dto.AgentCreditLogResponse, 0, len(logs))
	for _, log := range logs {
		items = append(items, agentCreditLogResponse(log))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func RootEnableAgent(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	account, err := service.EnableAgent(userID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.enable", map[string]interface{}{
		"agent_user_id": userID,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootDisableAgent(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	account, err := service.DisableAgent(userID)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.disable", map[string]interface{}{
		"agent_user_id": userID,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootUpdateAgentDailyLimit(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	var request dto.AgentDailyLimitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}
	account, err := service.UpdateAgentDailyLimit(userID, request.DailyCodeLimit)
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	recordManageAuditFor(c, userID, "agent.limit_update", map[string]interface{}{
		"agent_user_id":    userID,
		"daily_code_limit": account.DailyCodeLimit,
	})
	common.ApiSuccess(c, agentAccountResponse(*account, "", ""))
}

func RootAdjustAgentCredit(c *gin.Context) {
	userID, err := agentAdminUserID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid agent user ID")
		return
	}
	var request dto.AgentCreditAdjustmentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid request parameters")
		return
	}
	amount, err := service.ParseAgentPoints(request.Amount)
	if err != nil || amount <= 0 {
		common.ApiErrorMsg(c, "amount must be a positive value with at most two decimal places")
		return
	}
	result, err := service.AdjustAgentCredit(service.AgentCreditAdjustment{
		AgentUserID:    userID,
		OperatorUserID: c.GetInt("id"),
		Amount:         amount,
		Direction:      request.Direction,
		Reason:         request.Reason,
		IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		writeAgentAdminError(c, err)
		return
	}
	action := "agent.credit"
	if result.Log.EventType == model.AgentCreditEventAdminDebit {
		action = "agent.debit"
	}
	recordManageAuditFor(c, userID, action, map[string]interface{}{
		"agent_user_id": userID,
		"amount":        service.FormatAgentPoints(amount),
		"balance_after": service.FormatAgentPoints(result.Log.BalanceAfter),
		"reason":        result.Log.Remark,
	})
	common.ApiSuccess(c, dto.AgentCreditAdjustmentResponse{
		Account: dto.AgentCreditBalanceResponse{Balance: service.FormatAgentPoints(result.Account.Balance)},
		Log:     agentCreditLogResponse(result.Log),
	})
}

func agentAdminUserID(c *gin.Context) (int, error) {
	userID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userID <= 0 {
		return 0, errors.New("invalid agent user ID")
	}
	return userID, nil
}

func agentAccountResponse(account model.AgentAccount, username string, displayName string) dto.AgentAccountResponse {
	return dto.AgentAccountResponse{
		Id:             account.Id,
		UserId:         account.UserId,
		Username:       username,
		DisplayName:    displayName,
		Status:         account.Status,
		Balance:        service.FormatAgentPoints(account.Balance),
		DailyCodeLimit: account.DailyCodeLimit,
		DailyCountDate: account.DailyCountDate,
		DailyCodeCount: account.DailyCodeCount,
		Version:        account.Version,
		CreatedAt:      account.CreatedAt,
		UpdatedAt:      account.UpdatedAt,
	}
}

func agentCreditLogResponse(log model.AgentCreditLog) dto.AgentCreditLogResponse {
	return dto.AgentCreditLogResponse{
		Id:             log.Id,
		AgentUserId:    log.AgentUserId,
		Delta:          service.FormatAgentPoints(log.Delta),
		BalanceBefore:  service.FormatAgentPoints(log.BalanceBefore),
		BalanceAfter:   service.FormatAgentPoints(log.BalanceAfter),
		EventType:      log.EventType,
		BusinessKey:    log.BusinessKey,
		OrderId:        log.OrderId,
		RedemptionId:   log.RedemptionId,
		OperatorUserId: log.OperatorUserId,
		Remark:         log.Remark,
		CreatedAt:      log.CreatedAt,
	}
}

func writeAgentAdminError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAgentAccountNotFound), errors.Is(err, service.ErrAgentUserNotFound):
		common.ApiErrorMsg(c, "agent or user not found")
	case errors.Is(err, service.ErrAgentAccountDisabled):
		common.ApiErrorMsg(c, "agent account is disabled")
	case errors.Is(err, service.ErrAgentInvalidDailyLimit):
		common.ApiErrorMsg(c, "daily code limit must be positive")
	case errors.Is(err, service.ErrAgentInvalidAdjustment):
		common.ApiErrorMsg(c, "direction, reason, amount, and idempotency key are required")
	case errors.Is(err, service.ErrAgentInsufficientBalance):
		common.ApiErrorMsg(c, "agent balance is insufficient")
	case errors.Is(err, service.ErrAgentIdempotencyConflict):
		common.ApiErrorMsg(c, "idempotency key was already used for a different adjustment")
	case errors.Is(err, service.ErrAgentAccountConflict):
		common.ApiErrorMsg(c, "agent account changed concurrently; please retry")
	case errors.Is(err, service.ErrAgentBalanceOverflow):
		common.ApiErrorMsg(c, "agent balance is outside the supported range")
	default:
		common.SysError("agent administration failed: " + err.Error())
		common.ApiErrorMsg(c, "agent account operation failed")
	}
}
