package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentAdminResponseFormatsMoneyAsStrings(t *testing.T) {
	account := agentAccountResponse(model.AgentAccount{Balance: 123456}, "agent", "Agent")
	assert.Equal(t, "1234.56", account.Balance)

	log := agentCreditLogResponse(model.AgentCreditLog{
		Delta: -125, BalanceBefore: 123456, BalanceAfter: 123331,
	})
	assert.Equal(t, "-1.25", log.Delta)
	assert.Equal(t, "1234.56", log.BalanceBefore)
	assert.Equal(t, "1233.31", log.BalanceAfter)

	raw, err := common.Marshal(struct {
		Account interface{} `json:"account"`
		Log     interface{} `json:"log"`
	}{Account: account, Log: log})
	require.NoError(t, err)
	assert.NotContains(t, string(raw), "123456")
}

func TestAgentStatusIncludesFeatureSwitch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setting := operation_setting.GetAgentSetting()
	original := setting.Enabled
	setting.Enabled = true
	t.Cleanup(func() { setting.Enabled = original })

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("GET", "/api/status", nil)
	GetStatus(context)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AgentEnabled bool `json:"agent_enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.True(t, response.Data.AgentEnabled)
}

func TestAgentAuditActionsHaveStableContent(t *testing.T) {
	params := map[string]interface{}{
		"agent_user_id":    10,
		"amount":           "100.00",
		"daily_code_limit": 200,
	}
	assert.Contains(t, auditContentEN("agent.enable", params), "10")
	assert.Contains(t, auditContentEN("agent.disable", params), "10")
	assert.Contains(t, auditContentEN("agent.limit_update", params), "200")
	assert.Contains(t, auditContentEN("agent.credit", params), "100.00")
	assert.Contains(t, auditContentEN("agent.debit", params), "100.00")
}
