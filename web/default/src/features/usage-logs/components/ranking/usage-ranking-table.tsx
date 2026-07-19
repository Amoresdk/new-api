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
import type { ColumnDef, Table as TanstackTable } from '@tanstack/react-table'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, DataTableRow } from '@/components/data-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCompactNumber,
  formatQuota,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'

import type { UsageRankingGroupStat, UsageRankingItem } from '../../types'
import {
  formatUsageRankingRatio,
  getUsageRankingRowKey,
} from './usage-ranking-columns'

const RIGHT_ALIGNED_COLUMNS = new Set([
  'quota',
  'request_count',
  'total_tokens',
  'prompt_tokens',
  'completion_tokens',
  'avg_use_time',
  'error_rate',
  'stream_ratio',
  'model_count',
  'token_count',
  'group_count',
  'channel_count',
])

interface UsageRankingTableProps {
  table: TanstackTable<UsageRankingItem>
  columns: ColumnDef<UsageRankingItem, unknown>[]
  loading: boolean
  fetching: boolean
  expandedRows: Set<string>
  toolbar: ReactNode
  mobile: ReactNode
}

export function UsageRankingGroupDetails(props: {
  groups: UsageRankingGroupStat[]
}) {
  const { t } = useTranslation()

  return (
    <div className='bg-muted/30 rounded-lg border p-2'>
      <div className='text-muted-foreground mb-2 text-xs font-medium'>
        {t('Group Breakdown')}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Group')}</TableHead>
            <TableHead className='text-right'>{t('Consumed Quota')}</TableHead>
            <TableHead className='text-right'>{t('Request Count')}</TableHead>
            <TableHead className='text-right'>{t('Total Tokens')}</TableHead>
            <TableHead className='text-right'>
              {t('Average Duration')}
            </TableHead>
            <TableHead className='text-right'>{t('Error Rate')}</TableHead>
            <TableHead className='text-right'>{t('Stream Ratio')}</TableHead>
            <TableHead className='text-right'>{t('Models')}</TableHead>
            <TableHead className='text-right'>{t('Tokens')}</TableHead>
            <TableHead className='text-right'>{t('Channels')}</TableHead>
            <TableHead>{t('Latest Request Time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.groups.map((group) => (
            <TableRow key={group.group || '__empty_group'}>
              <TableCell className='font-medium'>
                {group.group || t('Unnamed Group')}
              </TableCell>
              <TableCell className='text-right'>
                {formatQuota(group.quota)}
              </TableCell>
              <TableCell className='text-right'>
                {formatCompactNumber(group.request_count)}
              </TableCell>
              <TableCell className='text-right'>
                {formatCompactNumber(group.total_tokens)}
              </TableCell>
              <TableCell className='text-right'>
                {formatUseTime(group.avg_use_time)}
              </TableCell>
              <TableCell className='text-right'>
                {formatUsageRankingRatio(group.error_rate)}
              </TableCell>
              <TableCell className='text-right'>
                {formatUsageRankingRatio(group.stream_ratio)}
              </TableCell>
              <TableCell className='text-right'>
                {formatCompactNumber(group.model_count)}
              </TableCell>
              <TableCell className='text-right'>
                {formatCompactNumber(group.token_count)}
              </TableCell>
              <TableCell className='text-right'>
                {formatCompactNumber(group.channel_count)}
              </TableCell>
              <TableCell>{formatTimestampToDate(group.last_used_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function UsageRankingTable(props: UsageRankingTableProps) {
  const { t } = useTranslation()

  return (
    <DataTablePage
      table={props.table}
      columns={props.columns}
      isLoading={props.loading}
      isFetching={props.fetching}
      emptyTitle={t('No Ranking Data')}
      emptyDescription={t(
        'No usage was found for the selected ranking filters.'
      )}
      skeletonKeyPrefix='usage-ranking-skeleton'
      applyHeaderSize
      toolbar={props.toolbar}
      mobile={props.mobile}
      tableClassName='[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_th]:text-[13px]'
      getColumnClassName={(columnId) =>
        RIGHT_ALIGNED_COLUMNS.has(columnId) ? 'text-right' : undefined
      }
      renderRow={(row, helpers) => {
        const rowKey = getUsageRankingRowKey(row.original)
        const expanded = props.expandedRows.has(rowKey)
        return (
          <Fragment key={row.id}>
            <DataTableRow
              row={row}
              aria-expanded={expanded}
              getColumnClassName={helpers.getCellClassName}
              cellRenderColumns={props.columns}
            />
            {expanded && (
              <TableRow
                key={`${row.id}-groups`}
                className='hover:bg-transparent'
              >
                <TableCell
                  colSpan={row.getVisibleCells().length}
                  className='p-3'
                >
                  <UsageRankingGroupDetails groups={row.original.group_stats} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        )
      }}
    />
  )
}
