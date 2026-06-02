import React from 'react';
import { Card, Table, Tag, Space, Typography } from 'antd';
import type { TableSchema } from '@/types/acceptance-demo';
import ConstraintBadge from './ConstraintBadge';

interface TableSchemaCardProps {
  schema: TableSchema;
}

const TableSchemaCard: React.FC<TableSchemaCardProps> = ({ schema }) => {
  const columns = [
    {
      title: '字段名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Typography.Text code style={{ fontSize: 13 }}>
          {name}
        </Typography.Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>
          {type}
        </Typography.Text>
      ),
    },
    {
      title: '可空',
      dataIndex: 'nullable',
      key: 'nullable',
      render: (nullable: boolean) =>
        nullable ? (
          <Tag color="default">NULL</Tag>
        ) : (
          <Tag color="success">NOT NULL</Tag>
        ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (val: string | undefined) =>
        val ? (
          <Typography.Text type="warning" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {val}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            -
          </Typography.Text>
        ),
    },
    {
      title: '特殊说明',
      dataIndex: 'special',
      key: 'special',
      render: (special: string | undefined) =>
        special ? (
          <Typography.Text style={{ fontSize: 12, color: '#722ed1' }}>
            {special}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            -
          </Typography.Text>
        ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {schema.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {schema.description}
          </Typography.Text>
        </Space>
      }
      style={{ marginBottom: 16 }}
      size="small"
    >
      <Table
        columns={columns}
        dataSource={schema.fields.map((f, i) => ({ ...f, key: i }))}
        pagination={false}
        size="small"
        bordered
      />
      {schema.constraints.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            约束：
          </Typography.Text>
          <Space wrap style={{ marginTop: 4 }}>
            {schema.constraints.map((c, i) => (
              <ConstraintBadge key={i} type={c.type} />
            ))}
          </Space>
        </div>
      )}
      {schema.indexes && schema.indexes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            索引：
          </Typography.Text>
          <Space wrap style={{ marginTop: 4 }}>
            {schema.indexes.map((idx, i) => (
              <Tag key={i} color="blue" style={{ fontSize: 12 }}>
                {idx}
              </Tag>
            ))}
          </Space>
        </div>
      )}
      {schema.specialFeatures && schema.specialFeatures.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            特殊特性：
          </Typography.Text>
          <Space wrap style={{ marginTop: 4 }}>
            {schema.specialFeatures.map((feat, i) => (
              <Tag key={i} color="purple" style={{ fontSize: 12 }}>
                {feat}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
};

export default TableSchemaCard;
