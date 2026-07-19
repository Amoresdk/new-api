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

import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { api } from '@/lib/api'

import {
  exportAgentCodes,
  getAdminAgentOrders,
  getAgentAccessOverview,
  getAgentCodes,
  getAgentOrders,
} from './api'
import type { AgentCodeParams, AgentOrderParams } from './types'

const emptyPage = {
  success: true,
  message: '',
  data: { page: 1, page_size: 10, total: 0, items: [] },
}

function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  contentType = 'application/json'
): AxiosResponse {
  return {
    config,
    data,
    headers: { 'content-type': contentType },
    status: 200,
    statusText: 'OK',
  }
}

describe('agent API request isolation', () => {
  test('whitelists self-service order, code, and export filters', async () => {
    const originalAdapter = api.defaults.adapter
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (config) => {
      requests.push(config)
      if (config.url?.endsWith('/export')) {
        return response(config, new Blob(['code\n']), 'text/csv; charset=utf-8')
      }
      return response(config, emptyPage)
    }
    api.defaults.adapter = adapter

    try {
      const orderParams = {
        p: 2,
        plan_id: 7,
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentOrderParams & { unexpected: string }
      const codeParams = {
        page_size: 25,
        order_id: 8,
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentCodeParams & { unexpected: string }

      await getAgentOrders(orderParams)
      await getAgentCodes(codeParams)
      await exportAgentCodes(codeParams)

      assert.equal(requests.length, 3)
      for (const request of requests) {
        const params = request.params as Record<string, unknown>
        assert.equal(Object.hasOwn(params, 'agent_user_id'), false)
        assert.equal(Object.hasOwn(params, 'unexpected'), false)
      }
      assert.equal((requests[0].params as Record<string, unknown>).plan_id, 7)
      assert.equal((requests[1].params as Record<string, unknown>).order_id, 8)
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('preserves the admin agent filter', async () => {
    const originalAdapter = api.defaults.adapter
    let captured: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      captured = config
      return response(config, emptyPage)
    }

    try {
      await getAdminAgentOrders({ agent_user_id: 42 })
      assert.ok(captured)
      assert.equal(
        (captured.params as Record<string, unknown>).agent_user_id,
        42
      )
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('isolates the access probe from ordinary duplicate GET requests', async () => {
    const originalAdapter = api.defaults.adapter
    let captured: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      captured = config
      return response(config, {
        success: false,
        message: 'agent account not found',
      })
    }

    try {
      const result = await getAgentAccessOverview()
      assert.equal(result.success, false)
      assert.equal(captured?.skipBusinessError, true)
      assert.equal(captured?.skipErrorHandler, true)
      assert.equal(captured?.disableDuplicate, true)
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })
})
