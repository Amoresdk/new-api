/*
Copyright (C) 2025 QuantumNous

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

import React, { useMemo } from 'react';
import { Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardTable from '../../../common/ui/CardTable';
import {
  renderNumber,
  renderQuota,
  timestamp2string,
} from '../../../../helpers';
import './usage-ranking-table.css';

const { Text } = Typography;

const renderPercent = (value) => `${((Number(value) || 0) * 100).toFixed(1)}%`;

const renderRank = (rank) => {
  if (rank === 1) return <Tag color='amber'>#1</Tag>;
  if (rank === 2) return <Tag color='grey'>#2</Tag>;
  if (rank === 3) return <Tag color='orange'>#3</Tag>;
  if (rank <= 10) return <Tag color='blue'>Top {rank}</Tag>;
  return <Tag>#{rank}</Tag>;
};

const UsageRankingTable = ({
  items,
  loading,
  expandedRowKeys,
  setExpandedRowKeys,
  t,
}) => {
  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        _ranking_key: `${item.user_id}:${item.username}`,
      })),
    [items],
  );

  const columns = useMemo(
    () => [
      {
        title: t('排名'),
        dataIndex: 'rank',
        key: 'rank',
        width: 86,
        fixed: true,
        render: renderRank,
      },
      {
        title: t('用户'),
        dataIndex: 'username',
        key: 'username',
        width: 180,
        fixed: true,
        render: (username, record) => (
          <Space vertical spacing={0} align='start'>
            <Text strong ellipsis={{ showTooltip: true }}>
              {username || '-'}
            </Text>
            <Text type='secondary' size='small'>
              ID: {record.user_id}
            </Text>
          </Space>
        ),
      },
      {
        title: t('消费额度'),
        dataIndex: 'quota',
        key: 'quota',
        render: (quota) => <Text strong>{renderQuota(quota)}</Text>,
      },
      {
        title: t('调用次数'),
        dataIndex: 'request_count',
        key: 'request_count',
        render: renderNumber,
      },
      {
        title: t('Tokens'),
        dataIndex: 'total_tokens',
        key: 'total_tokens',
        render: renderNumber,
      },
      {
        title: t('输入'),
        dataIndex: 'prompt_tokens',
        key: 'prompt_tokens',
        render: renderNumber,
      },
      {
        title: t('输出'),
        dataIndex: 'completion_tokens',
        key: 'completion_tokens',
        render: renderNumber,
      },
      {
        title: t('平均耗时'),
        dataIndex: 'avg_use_time',
        key: 'avg_use_time',
        render: (seconds) => `${(Number(seconds) || 0).toFixed(2)} s`,
      },
      {
        title: t('错误率'),
        dataIndex: 'error_rate',
        key: 'error_rate',
        render: (rate, record) => (
          <Space spacing={4}>
            <span>{renderPercent(rate)}</span>
            {record.error_count > 0 && (
              <Tag color='red' shape='circle'>
                {renderNumber(record.error_count)}
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: t('流式占比'),
        dataIndex: 'stream_ratio',
        key: 'stream_ratio',
        render: renderPercent,
      },
      {
        title: t('模型数'),
        dataIndex: 'model_count',
        key: 'model_count',
        render: renderNumber,
      },
      {
        title: t('令牌数'),
        dataIndex: 'token_count',
        key: 'token_count',
        render: renderNumber,
      },
      {
        title: t('分组数'),
        dataIndex: 'group_count',
        key: 'group_count',
        render: renderNumber,
      },
      {
        title: t('渠道数'),
        dataIndex: 'channel_count',
        key: 'channel_count',
        render: renderNumber,
      },
      {
        title: t('最近调用时间'),
        dataIndex: 'last_used_at',
        key: 'last_used_at',
        width: 170,
        render: (timestamp) =>
          timestamp > 0 ? timestamp2string(timestamp) : '-',
      },
    ],
    [t],
  );

  const groupColumns = useMemo(
    () => [
      {
        title: t('分组'),
        dataIndex: 'group',
        key: 'group',
        width: 130,
        fixed: true,
        render: (group) => <Text strong>{group || t('未命名分组')}</Text>,
      },
      {
        title: t('消费额度'),
        dataIndex: 'quota',
        key: 'quota',
        render: (quota) => <Text strong>{renderQuota(quota)}</Text>,
      },
      {
        title: t('调用次数'),
        dataIndex: 'request_count',
        key: 'request_count',
        render: renderNumber,
      },
      {
        title: t('Tokens'),
        dataIndex: 'total_tokens',
        key: 'total_tokens',
        render: renderNumber,
      },
      {
        title: t('输入'),
        dataIndex: 'prompt_tokens',
        key: 'prompt_tokens',
        render: renderNumber,
      },
      {
        title: t('输出'),
        dataIndex: 'completion_tokens',
        key: 'completion_tokens',
        render: renderNumber,
      },
      {
        title: t('平均耗时'),
        dataIndex: 'avg_use_time',
        key: 'avg_use_time',
        render: (seconds) => `${(Number(seconds) || 0).toFixed(2)} s`,
      },
      {
        title: t('错误率'),
        dataIndex: 'error_rate',
        key: 'error_rate',
        render: (rate, record) =>
          `${renderPercent(rate)} (${renderNumber(record.error_count)})`,
      },
      {
        title: t('流式占比'),
        dataIndex: 'stream_ratio',
        key: 'stream_ratio',
        render: renderPercent,
      },
      {
        title: t('模型数'),
        dataIndex: 'model_count',
        key: 'model_count',
        render: renderNumber,
      },
      {
        title: t('令牌数'),
        dataIndex: 'token_count',
        key: 'token_count',
        render: renderNumber,
      },
      {
        title: t('渠道数'),
        dataIndex: 'channel_count',
        key: 'channel_count',
        render: renderNumber,
      },
      {
        title: t('最近调用时间'),
        dataIndex: 'last_used_at',
        key: 'last_used_at',
        width: 170,
        render: (timestamp) =>
          timestamp > 0 ? timestamp2string(timestamp) : '-',
      },
    ],
    [t],
  );

  return (
    <CardTable
      columns={columns}
      dataSource={rows}
      rowKey='_ranking_key'
      loading={loading}
      scroll={{ x: 'max-content' }}
      className='usage-ranking-table rounded-xl overflow-hidden'
      size='middle'
      expandedRowKeys={expandedRowKeys}
      onExpandedRowsChange={(expandedRows = []) =>
        setExpandedRowKeys(expandedRows.map((row) => row._ranking_key))
      }
      expandedRowRender={(record) => (
        <div className='usage-ranking-group-stats'>
          <CardTable
            columns={groupColumns}
            dataSource={(record.group_stats || []).map((group) => ({
              ...group,
              _group_key: `${record._ranking_key}:${group.group}`,
            }))}
            rowKey='_group_key'
            hidePagination
            pagination={false}
            size='small'
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
      rowExpandable={(record) => record.group_stats?.length > 0}
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 140, height: 140 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 140, height: 140 }} />
          }
          description={t('暂无排行数据')}
          style={{ padding: 24 }}
        />
      }
      hidePagination
    />
  );
};

export default UsageRankingTable;
