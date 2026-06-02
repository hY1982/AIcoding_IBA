import React, { useMemo, useState } from 'react';
import { Input, Select, Space, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { TestScenario, ScenarioFilters } from '@/types/test-dashboard';
import { modules, scenarios } from '@/data/test-scenarios';
import StatusBadge from './StatusBadge';

/**
 * 测试场景列表
 *
 * 展示所有测试场景的表格，支持：
 * - 按模块筛选
 * - 按状态筛选
 * - 关键词搜索（场景名称、ID）
 * - 点击行查看详情
 */

interface TestScenarioListProps {
  onSelectScenario: (scenario: TestScenario) => void;
  initialModuleId?: string | null;
}

const TestScenarioList: React.FC<TestScenarioListProps> = ({
  onSelectScenario,
  initialModuleId = null,
}) => {
  const [filters, setFilters] = useState<ScenarioFilters>({
    moduleId: initialModuleId,
    status: null,
    keyword: '',
  });

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((s) => {
      if (filters.moduleId && s.moduleId !== filters.moduleId) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const matchName = s.name.toLowerCase().includes(kw);
        const matchId = s.id.toLowerCase().includes(kw);
        const matchModule = s.module.toLowerCase().includes(kw);
        if (!matchName && !matchId && !matchModule) return false;
      }
      return true;
    });
  }, [filters]);

  const moduleOptions = [
    { value: '', label: '全部模块' },
    ...modules.map((m) => ({ value: m.id, label: `${m.id} ${m.name}` })),
  ];

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'testable', label: '可测试' },
    { value: 'blocked', label: '阻塞' },
    { value: 'pending_dev', label: '待开发' },
    { value: 'pending_api', label: '待接口' },
  ];

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tag style={{ fontFamily: 'monospace' }}>{id}</Tag>,
    },
    {
      title: '场景名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TestScenario) => (
        <span style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => onSelectScenario(record)}>
          {name}
        </span>
      ),
    },
    {
      title: '所属模块',
      dataIndex: 'module',
      key: 'module',
      width: 140,
      render: (_module: string, record: TestScenario) => (
        <Tag>{record.moduleId}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TestScenario['status']) => <StatusBadge status={status} type="scenario" />,
    },
    {
      title: '风险',
      dataIndex: 'risks',
      key: 'risks',
      width: 100,
      render: (risks: TestScenario['risks']) => {
        const high = risks.filter((r) => r.level === 'high').length;
        const medium = risks.filter((r) => r.level === 'medium').length;
        if (high > 0) return <Tag color="error">{high} 高风险</Tag>;
        if (medium > 0) return <Tag color="warning">{medium} 中风险</Tag>;
        return <Tag color="success">无风险</Tag>;
      },
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {/* 筛选工具栏 */}
      <Space wrap>
        <Select
          style={{ width: 180 }}
          placeholder="按模块筛选"
          value={filters.moduleId || ''}
          onChange={(value: string) =>
            setFilters((prev) => ({ ...prev, moduleId: value || null }))
          }
          options={moduleOptions}
        />
        <Select
          style={{ width: 150 }}
          placeholder="按状态筛选"
          value={filters.status || ''}
          onChange={(value: string) =>
            setFilters((prev) => ({ ...prev, status: (value as TestScenario['status']) || null }))
          }
          options={statusOptions}
        />
        <Input
          style={{ width: 280 }}
          placeholder="搜索场景名称或编号..."
          prefix={<SearchOutlined />}
          value={filters.keyword}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, keyword: e.target.value }))
          }
          allowClear
        />
      </Space>

      {/* 场景表格 */}
      <Table
        dataSource={filteredScenarios}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5, 10, 20] }}
        onRow={(record) => ({
          onClick: () => onSelectScenario(record),
        })}
        locale={{ emptyText: '暂无匹配的测试场景' }}
      />
    </Space>
  );
};

export default TestScenarioList;
