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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  getTodayStartTimestamp,
  showError,
  timestamp2string,
} from '../../helpers';

const PAGE_SIZE_STORAGE_KEY = 'usage-ranking-page-size';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const createDefaultFilters = () => ({
  dateRange: [
    timestamp2string(getTodayStartTimestamp()),
    timestamp2string(Date.now() / 1000 + 3600),
  ],
  model_name: '',
  channel: '',
  group: '',
  sort_by: 'quota',
});

const createEmptyRanking = () => ({
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  summary: {
    quota: 0,
    request_count: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    active_user_count: 0,
  },
});

const getInitialPageSize = () => {
  try {
    const savedSize = Number.parseInt(
      localStorage.getItem(PAGE_SIZE_STORAGE_KEY),
      10,
    );
    return PAGE_SIZE_OPTIONS.includes(savedSize) ? savedSize : 20;
  } catch {
    return 20;
  }
};

export const useUsageRankingData = (active) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultFilters);
  const [ranking, setRanking] = useState(createEmptyRanking);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(getInitialPageSize);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    const controller = new AbortController();
    const loadRanking = async () => {
      setLoading(true);
      const [startTime, endTime] = appliedFilters.dateRange || [];
      try {
        const response = await API.get('/api/log/ranking', {
          params: {
            p: activePage,
            page_size: pageSize,
            start_timestamp: startTime
              ? Math.floor(new Date(startTime).getTime() / 1000)
              : undefined,
            end_timestamp: endTime
              ? Math.floor(new Date(endTime).getTime() / 1000)
              : undefined,
            model_name: appliedFilters.model_name || undefined,
            channel: appliedFilters.channel || undefined,
            group: appliedFilters.group || undefined,
            sort_by: appliedFilters.sort_by || 'quota',
          },
          signal: controller.signal,
        });
        const { success, message, data } = response.data;
        if (!success) {
          showError(t(message || '排行榜加载失败'));
          return;
        }
        setRanking({
          ...createEmptyRanking(),
          ...data,
          items: Array.isArray(data?.items) ? data.items : [],
          summary: {
            ...createEmptyRanking().summary,
            ...data?.summary,
          },
        });
      } catch (error) {
        if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') {
          showError(error);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadRanking();
    return () => controller.abort();
  }, [active, activePage, appliedFilters, pageSize, refreshVersion, t]);

  const applyFilters = useCallback((values) => {
    setFilters(values);
    setAppliedFilters(values);
    setActivePage(1);
    setExpandedRowKeys([]);
  }, []);

  const resetFilters = useCallback(() => {
    const defaults = createDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setActivePage(1);
    setExpandedRowKeys([]);
    return defaults;
  }, []);

  const handlePageChange = useCallback((page) => {
    setActivePage(page);
    setExpandedRowKeys([]);
  }, []);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setActivePage(1);
    setExpandedRowKeys([]);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // Storage can be unavailable in privacy modes; pagination still works.
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  return {
    filters,
    setFilters,
    appliedFilters,
    ranking,
    loading,
    activePage,
    pageSize,
    expandedRowKeys,
    setExpandedRowKeys,
    applyFilters,
    resetFilters,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    t,
  };
};
