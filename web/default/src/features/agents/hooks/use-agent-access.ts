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
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentAccessOverview } from '../api'
import type { AgentOverview, ApiResult } from '../types'

export const agentAccessQueryKey = (userID: number) =>
  ['agent', 'access', userID] as const

function isAgentAccessDenied(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403
}

type AgentAccessProbe = () => Promise<ApiResult<AgentOverview>>

export async function resolveAgentAccess(
  probe: AgentAccessProbe = getAgentAccessOverview
): Promise<AgentOverview | null> {
  try {
    const response = await probe()
    return response.success ? response.data : null
  } catch (error) {
    if (isAgentAccessDenied(error)) return null
    throw error
  }
}

export function useAgentAccess() {
  const userID = useAuthStore((state) => state.auth.user?.id)
  const { status } = useStatus()
  const globallyEnabled = status?.agent_enabled === true
  const shouldCheck = userID !== undefined && globallyEnabled

  const query = useQuery({
    queryKey: agentAccessQueryKey(userID ?? 0),
    queryFn: () => resolveAgentAccess(),
    enabled: shouldCheck,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) =>
      !isAgentAccessDenied(error) && failureCount < 1,
  })

  return {
    ...query,
    globallyEnabled,
    hasAccess: shouldCheck && query.data !== null && query.data !== undefined,
    isChecking: shouldCheck && query.isPending,
  }
}
