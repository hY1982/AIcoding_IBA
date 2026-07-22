import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Tag, Typography } from 'antd';
import { getPlayers } from '@/api/admin';
import type { AdminPlayerListItem } from '@shared/admin';

const { Title } = Typography;
const { Search } = Input;

/**
 * 球员管理页面
 *
 * 展示球员列表，支持分页、搜索、查看完整信息（管理员视角不脱敏）。
 */
const PlayerManagementPage: React.FC = () => {
  const [data, setData] = useState<AdminPlayerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const fetchPlayers = async (page: number, size: number, search?: string) => {
    setLoading(true);
    try {
      const result = await getPlayers({
        page,
        pageSize: size,
        keyword: search,
      });
      setData(result.list);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers(currentPage, pageSize, keyword);
  }, [currentPage, pageSize, keyword]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
    fetchPlayers(1, pageSize, value);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '手机号',
      key: 'phone',
      render: (_: unknown, record: AdminPlayerListItem) => record.phoneRaw || record.phone,
    },
    {
      title: '真实姓名',
      key: 'realName',
      render: (_: unknown, record: AdminPlayerListItem) => record.realNameRaw || record.realName || '-',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (value: string) => (value === 'male' ? '男' : '女'),
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 80,
    },
    {
      title: '身高(cm)',
      dataIndex: 'height',
      key: 'height',
      width: 100,
    },
    {
      title: '能力值',
      key: 'ability',
      render: (_: unknown, record: AdminPlayerListItem) =>
        `${record.totalAbilityScore}`,
    },
    {
      title: '位置',
      key: 'positions',
      render: (_: unknown, record: AdminPlayerListItem) =>
        record.positions?.map((p) => p.position).join(', ') || '-',
    },
    {
      title: '状态',
      dataIndex: 'userStatus',
      key: 'userStatus',
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'red'}>
          {value === 'active' ? '正常' : value}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>球员管理</Title>
      <Card style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索昵称或手机号"
          allowClear
          enterButton="搜索"
          size="middle"
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
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

export default PlayerManagementPage;
