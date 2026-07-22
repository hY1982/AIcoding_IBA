import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Tag, Typography } from 'antd';
import { getVenues } from '@/api/admin';
import type { Venue } from '@shared/venue';

const { Title } = Typography;
const { Search } = Input;

/**
 * 场地管理页面
 *
 * 展示场地列表，支持分页、搜索。
 */
const VenueManagementPage: React.FC = () => {
  const [data, setData] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');

  const fetchVenues = async (page: number, size: number, search?: string) => {
    setLoading(true);
    try {
      const result = await getVenues({
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
    fetchVenues(currentPage, pageSize, keyword);
  }, [currentPage, pageSize, keyword]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
    fetchVenues(1, pageSize, value);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '每小时价格',
      dataIndex: 'pricePerHour',
      key: 'pricePerHour',
      render: (value: number) => `¥${value}`,
    },
    {
      title: '场地数量',
      dataIndex: 'courtCount',
      key: 'courtCount',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'red'}>
          {value === 'active' ? '营业中' : '已停业'}
        </Tag>
      ),
    },
    {
      title: '评分',
      dataIndex: 'ratingAvg',
      key: 'ratingAvg',
      render: (value: number | null) => (value ? `${value}分` : '暂无'),
    },
    {
      title: '地区',
      dataIndex: 'regionCode',
      key: 'regionCode',
    },
  ];

  return (
    <div>
      <Title level={3}>场地管理</Title>
      <Card style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索名称或地址"
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

export default VenueManagementPage;
