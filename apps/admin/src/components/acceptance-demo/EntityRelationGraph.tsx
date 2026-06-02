import React from 'react';
import { Card, Space, Typography, Tag, Row, Col } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import type { EntityRelation, TableSchema } from '@/types/acceptance-demo';

interface EntityRelationGraphProps {
  relations: EntityRelation[];
  tables: TableSchema[];
}

const EntityRelationGraph: React.FC<EntityRelationGraphProps> = ({ relations, tables }) => {
  const tableNames = new Set(tables.map((t) => t.name));
  const filteredRelations = relations.filter(
    (r) => tableNames.has(r.fromTable) && tableNames.has(r.toTable)
  );

  if (filteredRelations.length === 0) {
    return (
      <Card>
        <Typography.Text type="secondary">当前步骤无实体关系</Typography.Text>
      </Card>
    );
  }

  const relationTypeLabels: Record<string, string> = {
    'one-to-one': '一对一',
    'one-to-many': '一对多',
    'many-to-many': '多对多',
  };

  const onDeleteColors: Record<string, string> = {
    CASCADE: '#ff4d4f',
    'SET NULL': '#faad14',
    'NO ACTION': '#1890ff',
  };

  return (
    <Card
      title={
        <Space>
          <BranchesOutlined />
          <Typography.Text strong>实体关系图</Typography.Text>
          <Tag>{filteredRelations.length} 个关系</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[8, 8]}>
        {filteredRelations.map((rel, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <Card
              size="small"
              style={{
                borderLeft: `4px solid ${onDeleteColors[rel.onDelete] || '#999'}`,
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Typography.Text code style={{ fontSize: 13 }}>
                    {rel.fromTable}
                  </Typography.Text>
                  <span style={{ color: '#999' }}>.</span>
                  <Typography.Text code style={{ fontSize: 12, color: '#1890ff' }}>
                    {rel.fromColumn}
                  </Typography.Text>
                </Space>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="default" style={{ fontSize: 11 }}>
                    {relationTypeLabels[rel.relationType]}
                  </Tag>
                  <span style={{ color: '#999', fontSize: 16 }}>→</span>
                  <Tag
                    color={onDeleteColors[rel.onDelete] ? 'default' : 'default'}
                    style={{
                      fontSize: 11,
                      color: onDeleteColors[rel.onDelete],
                      borderColor: onDeleteColors[rel.onDelete],
                    }}
                  >
                    ON DELETE {rel.onDelete}
                  </Tag>
                </div>
                <Space>
                  <Typography.Text code style={{ fontSize: 13 }}>
                    {rel.toTable}
                  </Typography.Text>
                  <span style={{ color: '#999' }}>.</span>
                  <Typography.Text code style={{ fontSize: 12, color: '#1890ff' }}>
                    {rel.toColumn}
                  </Typography.Text>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default EntityRelationGraph;
