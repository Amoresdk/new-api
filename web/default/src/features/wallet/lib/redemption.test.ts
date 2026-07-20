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

import type { TypedRedemption } from '@/features/agents/types'

import {
  executeRedemption,
  formatRedemptionEndTime,
  type RedemptionExecutionDependencies,
} from './redemption'

function dependencies(
  result:
    | { success: true; message: string; data: TypedRedemption }
    | { success: false; message: string }
) {
  const calls = {
    formattedQuotas: [] as number[],
    formattedDates: [] as number[],
    successes: [] as Array<
      | { type: 'quota'; quota: string }
      | { type: 'subscription'; planTitle: string; endDate: string }
    >,
    failures: 0,
    userRefreshes: 0,
    subscriptionRefreshes: 0,
  }
  const deps: RedemptionExecutionDependencies = {
    redeem: async () => result,
    formatQuota: (quota) => {
      calls.formattedQuotas.push(quota)
      return `quota:${quota}`
    },
    formatEndTime: (endTime) => {
      calls.formattedDates.push(endTime)
      return `date:${endTime}`
    },
    notifySuccess: (notice) => calls.successes.push(notice),
    notifyFailure: () => {
      calls.failures += 1
    },
    refreshUser: async () => {
      calls.userRefreshes += 1
    },
    refreshSubscriptions: async () => {
      calls.subscriptionRefreshes += 1
    },
  }
  return { calls, deps }
}

describe('wallet typed redemption', () => {
  test('quota redemption preserves quota formatting and refreshes only user state', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: { type: 'quota', quota: 250_000 },
    })

    assert.equal(await executeRedemption('quota-code', deps), true)
    assert.deepEqual(calls.formattedQuotas, [250_000])
    assert.deepEqual(calls.formattedDates, [])
    assert.deepEqual(calls.successes, [
      { type: 'quota', quota: 'quota:250000' },
    ])
    assert.equal(calls.userRefreshes, 1)
    assert.equal(calls.subscriptionRefreshes, 0)
  })

  test('subscription redemption never quota-formats its ID and visibly refreshes subscriptions', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: {
        type: 'subscription',
        subscription_id: 987654,
        plan_title: 'Pro Annual',
        end_time: 1_900_000_000,
      },
    })

    assert.equal(await executeRedemption('plan-code', deps), true)
    assert.deepEqual(calls.formattedQuotas, [])
    assert.deepEqual(calls.formattedDates, [1_900_000_000])
    assert.deepEqual(calls.successes, [
      {
        type: 'subscription',
        planTitle: 'Pro Annual',
        endDate: 'date:1900000000',
      },
    ])
    assert.equal(calls.userRefreshes, 1)
    assert.equal(calls.subscriptionRefreshes, 1)
  })

  test('business and transport failures expose only the generic failure effect', async () => {
    const business = dependencies({
      success: false,
      message: 'sensitive internal business detail',
    })
    assert.equal(await executeRedemption('bad-code', business.deps), false)
    assert.equal(business.calls.failures, 1)
    assert.deepEqual(business.calls.successes, [])
    assert.equal(business.calls.userRefreshes, 0)

    const transport = dependencies({
      success: false,
      message: 'unused',
    })
    transport.deps.redeem = async () => {
      throw new Error('sensitive transport detail')
    }
    assert.equal(await executeRedemption('bad-code', transport.deps), false)
    assert.equal(transport.calls.failures, 1)
    assert.deepEqual(transport.calls.successes, [])
  })

  test('refresh failures never reclassify an irreversible redemption as failed', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: { type: 'quota', quota: 100 },
    })
    deps.refreshUser = async () => {
      throw new Error('refresh failed')
    }
    assert.equal(await executeRedemption('already-redeemed', deps), true)
    assert.equal(calls.failures, 0)
    assert.deepEqual(calls.successes, [{ type: 'quota', quota: 'quota:100' }])
  })

  test('formats project Chinese language codes with valid Intl locales', () => {
    assert.doesNotThrow(() => formatRedemptionEndTime(1_900_000_000, 'zhCN'))
    assert.doesNotThrow(() => formatRedemptionEndTime(1_900_000_000, 'zhTW'))
  })

  test('waits for the actual subscription refresh before reporting completion', async () => {
    const { deps } = dependencies({
      success: true,
      message: '',
      data: {
        type: 'subscription',
        subscription_id: 9,
        plan_title: 'Pro',
        end_time: 1_900_000_000,
      },
    })
    let releaseNetwork: (() => void) | undefined
    let signalStarted: (() => void) | undefined
    const networkStarted = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    deps.refreshSubscriptions = async () => {
      signalStarted?.()
      await new Promise<void>((resolve) => {
        releaseNetwork = resolve
      })
    }

    let settled = false
    const redemption = executeRedemption('subscription-code', deps).then(
      (result) => {
        settled = true
        return result
      }
    )
    await networkStarted
    assert.equal(settled, false)
    releaseNetwork?.()
    assert.equal(await redemption, true)
    assert.equal(settled, true)
  })
})
