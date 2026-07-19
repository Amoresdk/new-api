package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentMoneyResponsesUseFixedDecimalStrings(t *testing.T) {
	response := AgentCreditAdjustmentResponse{
		Account: AgentCreditBalanceResponse{Balance: "1000.00"},
		Log: AgentCreditLogResponse{
			Delta:         "1000.00",
			BalanceBefore: "0.00",
			BalanceAfter:  "1000.00",
		},
	}

	raw, err := common.Marshal(response)
	require.NoError(t, err)
	encoded := string(raw)
	assert.Contains(t, encoded, `"balance":"1000.00"`)
	assert.Contains(t, encoded, `"delta":"1000.00"`)
	assert.Contains(t, encoded, `"balance_before":"0.00"`)
	assert.Contains(t, encoded, `"balance_after":"1000.00"`)
	assert.NotContains(t, encoded, `"balance":100000`)
	assert.NotContains(t, encoded, `"status"`)
	assert.NotContains(t, encoded, `"version"`)
	assert.NotContains(t, encoded, `"daily_code_limit"`)
}
