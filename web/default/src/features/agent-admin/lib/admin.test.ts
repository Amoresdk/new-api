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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  agentAdminQueryKeys,
  agentAdminSearchSchema,
  createCreditAttempt,
  getAgentAdminAccess,
  getRefundSelection,
  projectAgentBalance,
  validateAgentOfferDraft,
} from './admin'

describe('agent administration cache scope', () => {
  test('keeps mutation invalidation inside the signed-in admin and affected resource', () => {
    assert.deepEqual(agentAdminQueryKeys.agentsRoot(41), [
      'agent-admin',
      41,
      'agents',
    ])
    assert.deepEqual(agentAdminQueryKeys.ledgerRoot(41, 9), [
      'agent-admin',
      41,
      'ledger',
      9,
    ])
    assert.deepEqual(agentAdminQueryKeys.codesRoot(41), [
      'agent-admin',
      41,
      'codes',
    ])
  })
})

describe('agent administration access', () => {
  test('allows admins to read and only super admins to mutate', () => {
    assert.deepEqual(getAgentAdminAccess(undefined), {
      canRead: false,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(1), {
      canRead: false,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(10), {
      canRead: true,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(100), {
      canRead: true,
      canMutate: true,
    })
  })
})

describe('credit adjustment confirmation', () => {
  test('projects decimal point balances exactly without number arithmetic', () => {
    assert.equal(
      projectAgentBalance('9007199254740993.99', '0.02', 'credit'),
      '9007199254740994.01'
    )
    assert.equal(projectAgentBalance('10.00', '3.45', 'debit'), '6.55')
    assert.equal(projectAgentBalance('1.00', '1.01', 'debit'), '-0.01')
  })

  test('retains an idempotency key for retry and rotates on payload change', () => {
    let sequence = 0
    const uuid = () => `attempt-${++sequence}`
    const payload = {
      amount: '12.30',
      direction: 'credit' as const,
      reason: 'Opening balance',
    }
    const first = createCreditAttempt(undefined, payload, uuid)
    const retry = createCreditAttempt(first, { ...payload }, uuid)
    const changed = createCreditAttempt(
      first,
      { ...payload, amount: '12.31' },
      uuid
    )

    assert.equal(first.idempotencyKey, 'attempt-1')
    assert.equal(retry.idempotencyKey, first.idempotencyKey)
    assert.equal(changed.idempotencyKey, 'attempt-2')
  })
})

describe('offer and refund boundaries', () => {
  test('accepts only complete offer terms at server boundaries', () => {
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '0.01',
        codeValidDays: '1',
        refundFeeBps: '0',
      }),
      true
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3650',
        refundFeeBps: '10000',
      }),
      true
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '0',
        codeValidDays: '1',
        refundFeeBps: '0',
      }),
      false
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3651',
        refundFeeBps: '0',
      }),
      false
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '2',
        refundFeeBps: '10001',
      }),
      false
    )
  })

  test('permits a special refund only for unused codes owned by one agent', () => {
    const result = getRefundSelection([
      { id: 11, agentUserID: 7, status: 'unused' },
      { id: 12, agentUserID: 7, status: 'unused' },
    ])
    assert.deepEqual(result, { agentUserID: 7, redemptionIDs: [11, 12] })
    assert.equal(
      getRefundSelection([
        { id: 11, agentUserID: 7, status: 'unused' },
        { id: 12, agentUserID: 8, status: 'unused' },
      ]),
      null
    )
    assert.equal(
      getRefundSelection([{ id: 11, agentUserID: 7, status: 'used' }]),
      null
    )
  })
})

describe('agent administration URL state', () => {
  test('sanitizes invalid filters and preserves valid stable filters', () => {
    assert.deepEqual(
      agentAdminSearchSchema.parse({
        tab: 'orders',
        p: 3,
        agent_user_id: 12,
        status: 'completed',
      }),
      { tab: 'orders', p: 3, agent_user_id: 12, status: 'completed' }
    )
    assert.deepEqual(
      agentAdminSearchSchema.parse({
        tab: 'unknown',
        p: -5,
        agent_user_id: Number.MAX_SAFE_INTEGER + 1,
        status: 'unknown',
      }),
      { tab: 'agents', p: 1 }
    )
  })
})
