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

import { api, type ApiRequestConfig } from '@/lib/api'

import {
  adminAgentRefundRequestSchema,
  adminAgentSchema,
  agentCodeSchema,
  agentCodeStatusSchema,
  agentCreditAdjustmentRequestSchema,
  agentCreditAdjustmentResponseSchema,
  agentCreditLogSchema,
  agentDailyLimitRequestSchema,
  agentOfferSchema,
  agentOfferUpsertRequestSchema,
  agentOrderSchema,
  agentOrderStatusSchema,
  agentOverviewSchema,
  agentPageSchema,
  agentPurchaseRequestSchema,
  agentPurchaseResponseSchema,
  agentReconciliationSchema,
  agentRefundRequestSchema,
  agentRefundResponseSchema,
  apiResponseSchema,
  typedRedemptionRequestSchema,
  typedRedemptionSchema,
  type AdminAgent,
  type AdminAgentParams,
  type AdminAgentRefundRequest,
  type AgentCode,
  type AgentCodeParams,
  type AgentCreditAdjustmentRequest,
  type AgentCreditAdjustmentResponse,
  type AgentCreditLog,
  type AgentCreditLogParams,
  type AgentDailyLimitRequest,
  type AgentOffer,
  type AgentOfferUpsertRequest,
  type AgentOrder,
  type AgentOrderParams,
  type AgentOverview,
  type AgentPage,
  type AgentPurchaseRequest,
  type AgentPurchaseResponse,
  type AgentReconciliation,
  type AgentRefundRequest,
  type AgentRefundResponse,
  type ApiResult,
  type TypedRedemption,
  type TypedRedemptionRequest,
} from './types'

const positiveIDSchema = z.number().int().positive()
const agentOverviewResponseSchema = apiResponseSchema(agentOverviewSchema)
const agentOffersResponseSchema = apiResponseSchema(z.array(agentOfferSchema))
const agentPurchaseEnvelopeSchema = apiResponseSchema(
  agentPurchaseResponseSchema
)
const agentOrdersResponseSchema = apiResponseSchema(
  agentPageSchema(agentOrderSchema)
)
const agentCodesResponseSchema = apiResponseSchema(
  agentPageSchema(agentCodeSchema)
)
const agentCreditLogsResponseSchema = apiResponseSchema(
  agentPageSchema(agentCreditLogSchema)
)
const agentRefundEnvelopeSchema = apiResponseSchema(agentRefundResponseSchema)
const adminAgentsResponseSchema = apiResponseSchema(
  agentPageSchema(adminAgentSchema)
)
const adminAgentResponseSchema = apiResponseSchema(adminAgentSchema)
const agentOfferResponseSchema = apiResponseSchema(agentOfferSchema)
const agentReconciliationResponseSchema = apiResponseSchema(
  agentReconciliationSchema
)
const agentCreditAdjustmentEnvelopeSchema = apiResponseSchema(
  agentCreditAdjustmentResponseSchema
)
const typedRedemptionResponseSchema = apiResponseSchema(typedRedemptionSchema)
const csvResponseSchema = z
  .object({
    blob: z.instanceof(Blob),
    contentType: z.string().refine((value) => value.startsWith('text/csv')),
  })
  .strict()

const pageFilterFields = {
  p: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(100).optional(),
  start_timestamp: z.number().int().nonnegative().optional(),
  end_timestamp: z.number().int().nonnegative().optional(),
}
const selfOrderParamsSchema = z
  .object({
    ...pageFilterFields,
    plan_id: positiveIDSchema.optional(),
    status: agentOrderStatusSchema.optional(),
  })
  .strict()
const adminOrderParamsSchema = selfOrderParamsSchema.extend({
  agent_user_id: positiveIDSchema.optional(),
})
const selfCodeParamsSchema = z
  .object({
    ...pageFilterFields,
    plan_id: positiveIDSchema.optional(),
    order_id: positiveIDSchema.optional(),
    status: agentCodeStatusSchema.optional(),
  })
  .strict()
const adminCodeParamsSchema = selfCodeParamsSchema.extend({
  agent_user_id: positiveIDSchema.optional(),
})
const selfExportCodeParamsSchema = selfCodeParamsSchema.omit({
  p: true,
  page_size: true,
})

type SelfOrderParams = z.infer<typeof selfOrderParamsSchema>
type SelfCodeParams = z.infer<typeof selfCodeParamsSchema>
type SelfExportCodeParams = z.infer<typeof selfExportCodeParamsSchema>

function selfOrderParams(
  params: Omit<AgentOrderParams, 'agent_user_id'>
): SelfOrderParams {
  return selfOrderParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    status: params.status,
  })
}

function selfCodeParams(
  params: Omit<AgentCodeParams, 'agent_user_id'>
): SelfCodeParams {
  return selfCodeParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    order_id: params.order_id,
    status: params.status,
  })
}

function selfExportCodeParams(
  params: Omit<AgentCodeParams, 'agent_user_id' | 'p' | 'page_size'>
): SelfExportCodeParams {
  return selfExportCodeParamsSchema.parse({
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    order_id: params.order_id,
    status: params.status,
  })
}

export async function getAgentOverview(
  config: ApiRequestConfig = {}
): Promise<ApiResult<AgentOverview>> {
  const response = await api.get('/api/agent/overview', config)
  return agentOverviewResponseSchema.parse(response.data)
}

export async function getAgentAccessOverview(): Promise<
  ApiResult<AgentOverview>
> {
  return getAgentOverview({
    skipBusinessError: true,
    skipErrorHandler: true,
    disableDuplicate: true,
  })
}

export async function getAgentOffers(): Promise<ApiResult<AgentOffer[]>> {
  const response = await api.get('/api/agent/offers')
  return agentOffersResponseSchema.parse(response.data)
}

export async function purchaseAgentCodes(
  request: AgentPurchaseRequest
): Promise<ApiResult<AgentPurchaseResponse>> {
  const payload = agentPurchaseRequestSchema.parse(request)
  const response = await api.post('/api/agent/orders', payload)
  return agentPurchaseEnvelopeSchema.parse(response.data)
}

export async function getAgentOrders(
  params: Omit<AgentOrderParams, 'agent_user_id'> = {}
): Promise<ApiResult<AgentPage<AgentOrder>>> {
  const response = await api.get('/api/agent/orders', {
    params: selfOrderParams(params),
  })
  return agentOrdersResponseSchema.parse(response.data)
}

export async function getAgentCodes(
  params: Omit<AgentCodeParams, 'agent_user_id'> = {}
): Promise<ApiResult<AgentPage<AgentCode>>> {
  const response = await api.get('/api/agent/codes', {
    params: selfCodeParams(params),
  })
  return agentCodesResponseSchema.parse(response.data)
}

export async function exportAgentCodes(
  params: Omit<AgentCodeParams, 'agent_user_id' | 'p' | 'page_size'> = {}
): Promise<Blob> {
  const response = await api.get('/api/agent/codes/export', {
    params: selfExportCodeParams(params),
    responseType: 'blob',
  })
  const result = csvResponseSchema.parse({
    blob: response.data,
    contentType: response.headers['content-type'],
  })
  return result.blob
}

export async function getAgentCreditLogs(
  params: AgentCreditLogParams = {}
): Promise<ApiResult<AgentPage<AgentCreditLog>>> {
  const response = await api.get('/api/agent/credit-logs', { params })
  return agentCreditLogsResponseSchema.parse(response.data)
}

export async function refundAgentCodes(
  request: AgentRefundRequest
): Promise<ApiResult<AgentRefundResponse>> {
  const payload = agentRefundRequestSchema.parse(request)
  const response = await api.post('/api/agent/codes/refund', payload)
  return agentRefundEnvelopeSchema.parse(response.data)
}

export async function redeemTypedCode(
  request: TypedRedemptionRequest
): Promise<ApiResult<TypedRedemption>> {
  const payload = typedRedemptionRequestSchema.parse(request)
  const response = await api.post('/api/user/redeem', payload)
  return typedRedemptionResponseSchema.parse(response.data)
}

export async function getAdminAgents(
  params: AdminAgentParams = {}
): Promise<ApiResult<AgentPage<AdminAgent>>> {
  const response = await api.get('/api/agent-admin/agents', { params })
  return adminAgentsResponseSchema.parse(response.data)
}

export async function getAdminAgentCreditLogs(
  userID: number,
  params: Pick<AgentCreditLogParams, 'p' | 'page_size'> = {}
): Promise<ApiResult<AgentPage<AgentCreditLog>>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.get(`/api/agent-admin/agents/${id}/credit-logs`, {
    params,
  })
  return agentCreditLogsResponseSchema.parse(response.data)
}

export async function getAdminAgentOffers(): Promise<ApiResult<AgentOffer[]>> {
  const response = await api.get('/api/agent-admin/offers')
  return agentOffersResponseSchema.parse(response.data)
}

export async function getAdminAgentOrders(
  params: AgentOrderParams = {}
): Promise<ApiResult<AgentPage<AgentOrder>>> {
  const response = await api.get('/api/agent-admin/orders', {
    params: adminOrderParamsSchema.parse(params),
  })
  return agentOrdersResponseSchema.parse(response.data)
}

export async function getAdminAgentCodes(
  params: AgentCodeParams = {}
): Promise<ApiResult<AgentPage<AgentCode>>> {
  const response = await api.get('/api/agent-admin/codes', {
    params: adminCodeParamsSchema.parse(params),
  })
  return agentCodesResponseSchema.parse(response.data)
}

export async function getAdminAgentReconciliation(
  userID: number
): Promise<ApiResult<AgentReconciliation>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.get(`/api/agent-admin/agents/${id}/reconciliation`)
  return agentReconciliationResponseSchema.parse(response.data)
}

export async function enableAgent(
  userID: number
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.post(`/api/agent-admin/agents/${id}/enable`)
  return adminAgentResponseSchema.parse(response.data)
}

export async function disableAgent(
  userID: number
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.post(`/api/agent-admin/agents/${id}/disable`)
  return adminAgentResponseSchema.parse(response.data)
}

export async function updateAgentDailyLimit(
  userID: number,
  request: AgentDailyLimitRequest
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const payload = agentDailyLimitRequestSchema.parse(request)
  const response = await api.patch(
    `/api/agent-admin/agents/${id}/limit`,
    payload
  )
  return adminAgentResponseSchema.parse(response.data)
}

export async function adjustAgentCredit(
  userID: number,
  request: AgentCreditAdjustmentRequest
): Promise<ApiResult<AgentCreditAdjustmentResponse>> {
  const id = positiveIDSchema.parse(userID)
  const payload = agentCreditAdjustmentRequestSchema.parse(request)
  const response = await api.post(
    `/api/agent-admin/agents/${id}/credit-adjustments`,
    payload
  )
  return agentCreditAdjustmentEnvelopeSchema.parse(response.data)
}

export async function upsertAgentOffer(
  planID: number,
  request: AgentOfferUpsertRequest
): Promise<ApiResult<AgentOffer>> {
  const id = positiveIDSchema.parse(planID)
  const payload = agentOfferUpsertRequestSchema.parse(request)
  const response = await api.put(`/api/agent-admin/offers/${id}`, payload)
  return agentOfferResponseSchema.parse(response.data)
}

export async function refundAdminAgentCodes(
  request: AdminAgentRefundRequest
): Promise<ApiResult<AgentRefundResponse>> {
  const payload = adminAgentRefundRequestSchema.parse(request)
  const response = await api.post('/api/agent-admin/codes/refund', payload)
  return agentRefundEnvelopeSchema.parse(response.data)
}
