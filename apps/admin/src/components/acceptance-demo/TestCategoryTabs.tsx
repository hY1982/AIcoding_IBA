import React from 'react';
import { Card, Tabs, Table, Tag, Typography, Space } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { TestItem } from '@/types/acceptance-demo';
import { TEST_CATEGORY_LABELS } from '@/types/acceptance-demo';

interface TestCategoryTabsProps {
  testItems: TestItem[];
}

const TestCategoryTabs: React.FC<TestCategoryTabsProps> = ({ testItems }) => {
  const businessTests = testItems.filter((t) => t.category === 'business_logic');
  const databaseTests = testItems.filter((t) => t.category === 'database_professional');

  const columns = [
    {
      title: '测试名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Typography.Text strong style={{ fontSize: 13 }}>
          {name}
        </Typography.Text>
      ),
    },
    {
      title: '测试描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => (
        <Typography.Text style={{ fontSize: 13 }}>{desc}</Typography.Text>
      ),
    },
    {
      title: '预期结果',
      dataIndex: 'expectedResult',
      key: 'expectedResult',
      render: (result: string) => (
        <Typography.Text type="success" style={{ fontSize: 13 }}>
          {result}
        </Typography.Text>
      ),
    },
    {
      title: '涉及表',
      dataIndex: 'relatedTables',
      key: 'relatedTables',
      render: (tables: string[]) => (
        <Space wrap>
          {tables.map((t) => (
            <Tag key={t} color="blue" style={{ fontSize: 12 }}>
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  const renderTable = (items: TestItem[]) => (
    <Table
      columns={columns}
      dataSource={items.map((item, i) => ({ ...item, key: i }))}
      pagination={false}
      size="small"
      bordered
    />
  );

  return (
    <Card
      title={
        <Space>
          <ExperimentOutlined />
          <Typography.Text strong>测试分类</Typography.Text>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Tabs
        items={[
          {
            key: 'business',
            label: (
              <Space>
                {TEST_CATEGORY_LABELS.business_logic}
                <Tag color="blue">{businessTests.length}</Tag>
              </Space>
            ),
            children: renderTable(businessTests),
          },
          {
            key: 'database',
            label: (
              <Space>
                {TEST_CATEGORY_LABELS.database_professional}
                <Tag color="purple">{databaseTests.length}</Tag>
              </Space>
            ),
            children: renderTable(databaseTests),
          },
        ]}
      />
    </Card>
  );
};

export default TestCategoryTabs;
