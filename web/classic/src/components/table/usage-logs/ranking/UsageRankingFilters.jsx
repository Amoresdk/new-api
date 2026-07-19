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

import React, { useState } from 'react';
import { Button, Form } from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { DATE_RANGE_PRESETS } from '../../../../constants/console.constants';

const UsageRankingFilters = ({
  filters,
  applyFilters,
  resetFilters,
  refresh,
  loading,
  t,
}) => {
  const [formApi, setFormApi] = useState(null);

  return (
    <Form
      initValues={filters}
      getFormApi={setFormApi}
      onSubmit={applyFilters}
      allowEmpty
      autoComplete='off'
      layout='vertical'
    >
      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
          <div className='col-span-1 lg:col-span-2'>
            <Form.DatePicker
              field='dateRange'
              className='w-full'
              type='dateTimeRange'
              placeholder={[t('开始时间'), t('结束时间')]}
              presets={DATE_RANGE_PRESETS.map((preset) => ({
                text: t(preset.text),
                start: preset.start(),
                end: preset.end(),
              }))}
              pure
              size='small'
            />
          </div>
          <Form.Input
            field='model_name'
            prefix={<IconSearch />}
            placeholder={t('模型名称')}
            showClear
            pure
            size='small'
          />
          <Form.Input
            field='group'
            prefix={<IconSearch />}
            placeholder={t('分组')}
            showClear
            pure
            size='small'
          />
          <Form.InputNumber
            field='channel'
            min={0}
            placeholder={t('渠道 ID')}
            showClear
            pure
            size='small'
          />
          <Form.Select
            field='sort_by'
            placeholder={t('排序方式')}
            pure
            size='small'
          >
            <Form.Select.Option value='quota'>
              {t('按消费额度')}
            </Form.Select.Option>
            <Form.Select.Option value='request_count'>
              {t('按调用次数')}
            </Form.Select.Option>
          </Form.Select>
        </div>

        <div className='flex flex-wrap justify-end gap-2'>
          <Button
            type='tertiary'
            theme='borderless'
            icon={<IconRefresh />}
            onClick={refresh}
            loading={loading}
            size='small'
          >
            {t('刷新')}
          </Button>
          <Button
            type='tertiary'
            onClick={() => {
              const defaults = resetFilters();
              formApi?.setValues(defaults);
            }}
            size='small'
          >
            {t('重置')}
          </Button>
          <Button
            type='primary'
            htmlType='submit'
            loading={loading}
            size='small'
          >
            {t('查询')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default UsageRankingFilters;
