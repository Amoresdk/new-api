package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentAdminRoutesUseAdminReadsAndRootMutations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AgentAccount{}, &model.AgentCreditLog{}))
	model.DB, model.LOG_DB = db, db
	t.Cleanup(func() { model.DB, model.LOG_DB = originalDB, originalLogDB })
	require.NoError(t, db.Create(&model.User{
		Id: 1, Username: "admin", AffCode: "admin-aff",
		Role: common.RoleAdminUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.User{
		Id: 2, Username: "agent", AffCode: "agent-aff",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{
		UserId: 2, Status: model.AgentAccountStatusActive,
		DailyCodeLimit: model.DefaultAgentDailyCodeLimit,
	}).Error)

	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("agent-admin-route-test"))))
	engine.GET("/test/admin-login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "admin")
		session.Set("role", common.RoleAdminUser)
		session.Set("id", 1)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/test/admin-login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)
	cookies := loginRecorder.Result().Cookies()
	require.NotEmpty(t, cookies)

	readRecorder := httptest.NewRecorder()
	readRequest := httptest.NewRequest(http.MethodGet, "/api/agent-admin/agents", nil)
	readRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		readRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(readRecorder, readRequest)
	var readResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(readRecorder.Body.Bytes(), &readResponse))
	assert.True(t, readResponse.Success, readRecorder.Body.String())

	mutationRecorder := httptest.NewRecorder()
	mutationRequest := httptest.NewRequest(http.MethodPost, "/api/agent-admin/agents/2/disable", nil)
	mutationRequest.Header.Set("New-Api-User", "1")
	for _, sessionCookie := range cookies {
		mutationRequest.AddCookie(sessionCookie)
	}
	engine.ServeHTTP(mutationRecorder, mutationRequest)
	var mutationResponse struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(mutationRecorder.Body.Bytes(), &mutationResponse))
	assert.False(t, mutationResponse.Success, mutationRecorder.Body.String())

	var account model.AgentAccount
	require.NoError(t, db.Where("user_id = ?", 2).First(&account).Error)
	assert.Equal(t, model.AgentAccountStatusActive, account.Status)
}
