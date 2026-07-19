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
import { z } from 'zod'

import type { AgentCode } from '../types'
import { deriveAgentCodeStatus } from './money'

const optionalPositiveInteger = z
  .number()
  .int()
  .positive()
  .optional()
  .catch(undefined)
const optionalTimestamp = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .catch(undefined)

export const agentWorkspaceSearchSchema = z
  .object({
    tab: z
      .enum(['overview', 'orders', 'codes', 'ledger'])
      .optional()
      .catch('overview'),
    p: z.number().int().positive().optional().catch(1),
    page_size: z.number().int().positive().max(100).optional().catch(20),
    plan_id: optionalPositiveInteger,
    order_id: optionalPositiveInteger,
    order_status: z
      .enum(['completed', 'partially_refunded', 'refunded'])
      .optional()
      .catch(undefined),
    code_status: z
      .enum(['unused', 'used', 'refunded', 'expired'])
      .optional()
      .catch(undefined),
    event_type: z
      .enum(['admin_credit', 'admin_debit', 'purchase', 'refund'])
      .optional()
      .catch(undefined),
    start_timestamp: optionalTimestamp,
    end_timestamp: optionalTimestamp,
  })
  .transform(
    (search) =>
      Object.fromEntries(
        Object.entries(search).filter(([, value]) => value !== undefined)
      ) as {
        tab?: 'overview' | 'orders' | 'codes' | 'ledger'
        p?: number
        page_size?: number
        plan_id?: number
        order_id?: number
        order_status?: 'completed' | 'partially_refunded' | 'refunded'
        code_status?: 'unused' | 'used' | 'refunded' | 'expired'
        event_type?: 'admin_credit' | 'admin_debit' | 'purchase' | 'refund'
        start_timestamp?: number
        end_timestamp?: number
      }
  )

export type AgentWorkspaceSearch = z.infer<typeof agentWorkspaceSearchSchema>

export function timestampToLocalDateInput(
  timestamp: number | undefined
): string {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localDateInputToTimestamp(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }
  return Math.floor(date.getTime() / 1000)
}

export const agentQueryKeys = {
  overview: ['agent', 'overview'] as const,
  offers: ['agent', 'offers'] as const,
  orders: ['agent', 'orders'] as const,
  codes: ['agent', 'codes'] as const,
  creditLogs: ['agent', 'credit-logs'] as const,
}

export const agentMutationInvalidationKeys = [
  agentQueryKeys.overview,
  agentQueryKeys.orders,
  agentQueryKeys.codes,
  agentQueryKeys.creditLogs,
] as const

export function isRefundableAgentCode(
  code: AgentCode,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  return (
    code.code_visible &&
    deriveAgentCodeStatus(code.status, code.expired_at, nowSeconds) === 'unused'
  )
}

export function toggleRefundSelection(
  current: ReadonlySet<number>,
  codeID: number,
  selected: boolean
): { selection: Set<number>; changed: boolean } {
  const next = new Set(current)
  if (!selected) {
    const changed = next.delete(codeID)
    return { selection: next, changed }
  }
  if (next.has(codeID)) return { selection: next, changed: false }
  if (next.size >= 100) return { selection: next, changed: false }
  next.add(codeID)
  return { selection: next, changed: true }
}

export class AgentIdempotencyKeyStore {
  private fingerprint = ''
  private key = ''

  constructor(
    private readonly generate: () => string = () => crypto.randomUUID()
  ) {}

  keyFor(fingerprint: string): string {
    if (this.fingerprint !== fingerprint || this.key === '') {
      this.fingerprint = fingerprint
      this.key = this.generate()
    }
    return this.key
  }

  complete(): void {
    this.fingerprint = ''
    this.key = ''
  }
}
