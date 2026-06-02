import React from 'react';
import { Card, Space, Typography, Tag } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import type { StatusFlow } from '@/types/acceptance-demo';

interface StatusFlowDiagramProps {
  flows: StatusFlow[];
}

const StatusFlowDiagram: React.FC<StatusFlowDiagramProps> = ({ flows }) => {
  if (!flows || flows.length === 0) {
    return (
      <Card>
        <Typography.Text type="secondary">当前步骤无状态流转</Typography.Text>
      </Card>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {flows.map((flow) => (
        <Card
          key={flow.entity}
          title={
            <Space>
              <NodeIndexOutlined />
              <Typography.Text strong>
                {flow.entity}.{flow.field}
              </Typography.Text>
            </Space>
          }
          size="small"
          style={{ marginBottom: 12 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {flow.transitions.map((trans, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Tag color="blue" style={{ fontSize: 13 }}>
                  {flow.stateLabels[trans.from] || trans.from}
                </Tag>
                <span style={{ color: '#999' }}>→</span>
                {trans.to.length > 0 ? (
                  trans.to.map((toState) => (
                    <Tag
                      key={toState}
                      color="green"
                      style={{ fontSize: 13 }}
                    >
                      {flow.stateLabels[toState] || toState}
                    </Tag>
                  ))
                ) : (
                  <Tag color="default" style={{ fontSize: 13 }}>
                    终态
                  </Tag>
                )}
              </div>
            ))}
          </Space>
        </Card>
      ))}
    </Space>
  );
};

export default StatusFlowDiagram;
