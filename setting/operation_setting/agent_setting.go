package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// AgentSetting controls whether active agents can use the agent workspace.
// Administrative preparation remains available while this switch is off.
type AgentSetting struct {
	Enabled bool `json:"enabled"`
}

var agentSetting = AgentSetting{
	Enabled: false,
}

func init() {
	config.GlobalConfig.Register("agent_setting", &agentSetting)
}

func GetAgentSetting() *AgentSetting {
	return &agentSetting
}
