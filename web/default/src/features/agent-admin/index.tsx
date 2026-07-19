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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/auth-store'

import { AgentCodesTable } from './components/agent-codes-table'
import { AgentCreditLogsTable } from './components/agent-credit-logs-table'
import { AgentOffersTable } from './components/agent-offers-table'
import { AgentOrdersTable } from './components/agent-orders-table'
import { AgentsTable } from './components/agents-table'
import {
  agentAdminQueryKeys,
  getAgentAdminAccess,
  type AgentAdminSearch,
} from './lib/admin'

type AgentAdminProps = {
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

export function AgentAdmin(props: AgentAdminProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const access = getAgentAdminAccess(user?.role)
  const scope = user?.id ?? 0
  const changeTab = (tab: AgentAdminSearch['tab']) =>
    props.onSearchChange({
      tab,
      p: 1,
      keyword: undefined,
      agent_user_id: undefined,
      plan_id: undefined,
      order_id: undefined,
      status: undefined,
    })
  const refresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({
        queryKey: agentAdminQueryKeys.root,
      })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent management')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          disabled={refreshing}
          onClick={refresh}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            strokeWidth={2}
            data-icon='inline-start'
            className={refreshing ? 'animate-spin' : undefined}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {!access.canMutate && (
            <Alert>
              <AlertTitle>{t('Read-only agent administration')}</AlertTitle>
              <AlertDescription>
                {t(
                  'Administrators can inspect agents, offers, ledgers, orders, codes, and reconciliation. Only the super administrator can change financial or lifecycle data.'
                )}
              </AlertDescription>
            </Alert>
          )}
          <Tabs
            value={props.search.tab}
            onValueChange={(value) =>
              changeTab(value as AgentAdminSearch['tab'])
            }
          >
            <div className='overflow-x-auto pb-1'>
              <TabsList>
                <TabsTrigger value='agents'>{t('Agents')}</TabsTrigger>
                <TabsTrigger value='offers'>{t('Offers')}</TabsTrigger>
                <TabsTrigger value='orders'>{t('Orders')}</TabsTrigger>
                <TabsTrigger value='codes'>{t('Code inventory')}</TabsTrigger>
                <TabsTrigger value='ledger'>{t('Point ledger')}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='agents' className='pt-3'>
              <AgentsTable
                scope={scope}
                canMutate={access.canMutate}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='offers' className='pt-3'>
              <AgentOffersTable scope={scope} canMutate={access.canMutate} />
            </TabsContent>
            <TabsContent value='orders' className='pt-3'>
              <AgentOrdersTable
                scope={scope}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='codes' className='pt-3'>
              <AgentCodesTable
                scope={scope}
                canMutate={access.canMutate}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
            <TabsContent value='ledger' className='pt-3'>
              <AgentCreditLogsTable
                scope={scope}
                search={props.search}
                onSearchChange={props.onSearchChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
