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

import React from 'react';
import { Avatar, Card, Skeleton, Typography } from '@douyinfe/semi-ui';
import {
  IconCoinMoneyStroked,
  IconPulse,
  IconTextStroked,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { renderNumber, renderQuota } from '../../../../helpers';

const UsageRankingSummary = ({ summary, loading, t }) => {
  const items = [
    {
      title: t('总消费额度'),
      value: renderQuota(summary.quota),
      icon: <IconCoinMoneyStroked />,
      color: 'orange',
    },
    {
      title: t('总调用次数'),
      value: renderNumber(summary.request_count),
      icon: <IconPulse />,
      color: 'green',
    },
    {
      title: t('总 Tokens'),
      value: renderNumber(summary.total_tokens),
      icon: <IconTextStroked />,
      color: 'blue',
    },
    {
      title: t('活跃用户数'),
      value: renderNumber(summary.active_user_count),
      icon: <IconUserGroup />,
      color: 'violet',
    },
  ];

  return (
    <div className='usage-ranking-summary grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2'>
      {items.map((item) => (
        <Card
          key={item.title}
          className='!rounded-xl'
          bodyStyle={{ padding: 12 }}
        >
          <div className='flex items-center gap-3'>
            <Avatar color={item.color} size='small'>
              {item.icon}
            </Avatar>
            <div className='min-w-0'>
              <Typography.Text type='tertiary' size='small'>
                {item.title}
              </Typography.Text>
              <div className='text-lg font-semibold truncate'>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={<Skeleton.Title active style={{ width: 80 }} />}
                >
                  {item.value}
                </Skeleton>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default UsageRankingSummary;
