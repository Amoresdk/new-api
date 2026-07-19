package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestUserRedeemRouteIsRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	found := false
	for _, route := range engine.Routes() {
		if route.Method == "POST" && route.Path == "/api/user/redeem" {
			found = true
			assert.Contains(t, route.Handler, "controller.Redeem")
		}
	}
	assert.True(t, found)
}
