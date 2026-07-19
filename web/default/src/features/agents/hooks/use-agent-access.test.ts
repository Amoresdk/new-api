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

import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { resolveAgentAccess } from './use-agent-access'

describe('agent access resolution', () => {
  test('maps business denial to no access', async () => {
    const result = await resolveAgentAccess(async () => ({
      success: false,
      message: 'agent account not found',
    }))
    assert.equal(result, null)
  })

  test('maps HTTP 403 to no access without retrying the probe', async () => {
    let calls = 0
    const config = {} as InternalAxiosRequestConfig
    const error = new AxiosError(
      'Forbidden',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      {
        config,
        data: { message: 'forbidden' },
        headers: {},
        status: 403,
        statusText: 'Forbidden',
      }
    )

    const result = await resolveAgentAccess(async () => {
      calls += 1
      throw error
    })
    assert.equal(result, null)
    assert.equal(calls, 1)
  })
})
