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
import CardPro from '../../../common/ui/CardPro';
import { createCardProPagination } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { useUsageRankingData } from '../../../../hooks/usage-logs/useUsageRankingData';
import UsageRankingFilters from './UsageRankingFilters';
import UsageRankingSummary from './UsageRankingSummary';
import UsageRankingTable from './UsageRankingTable';

const UsageRankingTab = ({ active }) => {
  const rankingData = useUsageRankingData(active);
  const isMobile = useIsMobile();

  return (
    <div className='usage-ranking-root'>
      <CardPro
        type='type2'
        statsArea={
          <UsageRankingSummary
            summary={rankingData.ranking.summary}
            loading={rankingData.loading}
            t={rankingData.t}
          />
        }
        searchArea={<UsageRankingFilters {...rankingData} />}
        paginationArea={createCardProPagination({
          currentPage: rankingData.activePage,
          pageSize: rankingData.pageSize,
          total: rankingData.ranking.total,
          onPageChange: rankingData.handlePageChange,
          onPageSizeChange: rankingData.handlePageSizeChange,
          pageSizeOpts: [10, 20, 50, 100],
          isMobile,
          t: rankingData.t,
        })}
        t={rankingData.t}
      >
        <UsageRankingTable
          items={rankingData.ranking.items}
          loading={rankingData.loading}
          expandedRowKeys={rankingData.expandedRowKeys}
          setExpandedRowKeys={rankingData.setExpandedRowKeys}
          t={rankingData.t}
        />
      </CardPro>
    </div>
  );
};

export default UsageRankingTab;
