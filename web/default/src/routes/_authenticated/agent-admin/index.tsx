/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { AgentAdmin } from '@/features/agent-admin'
import { agentAdminSearchSchema } from '@/features/agent-admin/lib/admin'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/agent-admin/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  validateSearch: agentAdminSearchSchema,
  component: AgentAdminRoute,
})

function AgentAdminRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const navigate = useNavigate()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const userRole = useAuthStore((state) => state.auth.user?.role ?? ROLE.GUEST)

  useEffect(() => {
    if (userRole < ROLE.ADMIN) {
      void navigate({ to: '/403', replace: true })
    }
  }, [navigate, userRole])

  if (userRole < ROLE.ADMIN) {
    return null
  }

  return (
    <AgentAdmin
      key={`${userID}:${userRole}`}
      search={search}
      onSearchChange={(updates) =>
        routeNavigate({
          replace: true,
          search: (previous) => ({ ...previous, ...updates }),
        })
      }
    />
  )
}
