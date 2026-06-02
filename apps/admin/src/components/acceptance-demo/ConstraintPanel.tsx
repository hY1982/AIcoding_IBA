import React from 'react';
import { Card, List, Typography, Space, Tag } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { ConstraintDef } from '@/types/acceptance-demo';
import ConstraintBadge from './ConstraintBadge';

interface ConstraintPanelProps {
  constraints: ConstraintDef[];
}

const ConstraintPanel: React.FC<ConstraintPanelProps> = ({ constraints }) => {
  const grouped = constraints.reduce<Record<string, ConstraintDef[]>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  const typeOrder = ['CHECK', 'UNIQUE', 'FK', 'NOT_NULL'] as const;

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined />
          <Typography.Text strong>数据库约束详情</Typography.Text>
          <Tag>{constraints.length} 个约束</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {typeOrder.map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        return (
          <div key={type} style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ fontSize: 14 }}>
              <ConstraintBadge type={type} />
              <span style={{ marginLeft: 8 }}>{items.length} 个</span>
            </Typography.Text>
            <List
              size="small"
              bordered
              dataSource={items}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Typography.Text code style={{ fontSize: 13 }}>
                        {item.table}.{item.columns?.join(', ') || '-'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.name}
                      </Typography.Text>
                    </Space>
                    <Typography.Text style={{ fontSize: 13 }}>
                      {item.description}
                    </Typography.Text>
                    {item.sql && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                      >
                        SQL: {item.sql}
                      </Typography.Text>
                    )}
                  </Space>
                </List.Item>
              )}
              style={{ marginTop: 8 }}
            />
          </div>
        );
      })}
    </Card>
  );
};

export default ConstraintPanel;
