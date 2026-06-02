import React from 'react';
import { Card, Table, Typography } from 'antd';
import type { SampleRecord } from '@/types/acceptance-demo';

interface SampleDataTableProps {
  tableName: string;
  records: SampleRecord[];
}

const SampleDataTable: React.FC<SampleDataTableProps> = ({ tableName, records }) => {
  if (!records || records.length === 0) {
    return (
      <Card title={tableName} size="small" style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">暂无示例数据</Typography.Text>
      </Card>
    );
  }

  const columns = Object.keys(records[0]).map((key) => ({
    title: key,
    dataIndex: key,
    key,
    render: (value: unknown) => {
      if (value === null) return <Typography.Text type="secondary">null</Typography.Text>;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (Array.isArray(value)) return JSON.stringify(value);
      return String(value);
    },
  }));

  return (
    <Card
      title={
        <Typography.Text code style={{ fontSize: 14 }}>
          {tableName}
        </Typography.Text>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Table
        columns={columns}
        dataSource={records.map((r, i) => ({ ...r, key: i }))}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default SampleDataTable;
