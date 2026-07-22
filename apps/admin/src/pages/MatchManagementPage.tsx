import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Tag, Typography, Select, Space } from 'antd';
import { getMatches } from '@/api/admin';
import { MATCH_STATUS_LABELS } from '@shared/match';
import type { AdminMatchListItem } from '@shared/admin';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

/**
 * 比赛管理页面
 *
 * 展示比赛列表，支持分页、搜索、状态筛选。
 */
const MatchManagementPage: React.FC = () => {
  const [data, setData] = useState<AdminMatchListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const fetchMatches = async (page: number, size: number, search?: string, status?: string) => {
    setLoading(true);
    try {
      const result = await getMatches({
        page,
        pageSize: size,
        keyword: search,
        status,
      });
      setData(result.list);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(currentPage, pageSize, keyword, statusFilter);
  }, [currentPage, pageSize, statusFilter]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
    fetchMatches(1, pageSize, value, statusFilter);
  };

  const handleStatusChange = (value: string | undefined) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending_players: 'blue',
      pending_venue: 'orange',
      confirmed: 'green',
      in_progress: 'cyan',
      completed: 'purple',
      cancelled: 'red',
      expired: 'default',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '场地',
      dataIndex: 'venueName',
      key: 'venueName',
    },
    {
      title: '赛制',
      dataIndex: 'formatName',
      key: 'formatName',
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={getStatusColor(value)}>
          {MATCH_STATUS_LABELS[value as keyof typeof MATCH_STATUS_LABELS] || value}
        </Tag>
      ),
    },
    {
      title: '确认人数',
      key: 'players',
      render: (_: unknown, record: AdminMatchListItem) =>
        `${record.confirmedPlayers} / ${record.requiredPlayers}`,
    },
    {
      title: '保证金',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      render: (value: string) => `¥${value}`,
    },
  ];

  return (
    <div>
      <Title level={3}>比赛管理</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Search
            placeholder="搜索场地或赛制"
            allowClear
            enterButton="搜索"
            size="middle"
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={handleStatusChange}
          >
            {Object.entries(MATCH_STATUS_LABELS).map(([key, label]) => (
              <Option key={key} value={key}>
                {label}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size) setPageSize(size);
          },
        }}
      />
    </div>
  );
};

export default MatchManagementPage;
