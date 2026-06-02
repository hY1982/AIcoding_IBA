import React from 'react';
import { Alert, Card, List, Space, Tag, Typography } from 'antd';
import { globalRisks } from '@/data/test-scenarios';
import StatusBadge from './StatusBadge';

/**
 * 风险汇总面板
 *
 * 按风险等级分组展示所有已识别的风险点，包括：
 * - 高风险（红色 Alert）
 * - 中风险（黄色 Alert）
 * - 低风险（蓝色 Alert）
 */

const { Text } = Typography;

const RiskAlertPanel: React.FC = () => {
  const highRisks = globalRisks.filter((r) => r.level === 'high');
  const mediumRisks = globalRisks.filter((r) => r.level === 'medium');
  const lowRisks = globalRisks.filter((r) => r.level === 'low');

  const renderRiskList = (risks: typeof globalRisks, alertType: 'error' | 'warning' | 'info') => (
    <List
      size="small"
      dataSource={risks}
      renderItem={(risk) => (
        <List.Item>
          <Alert
            style={{ width: '100%' }}
            message={
              <Space>
                <StatusBadge status={risk.level} type="risk" />
                {risk.relatedModuleId && (
                  <Tag>{risk.relatedModuleId}</Tag>
                )}
              </Space>
            }
            description={
              <Space direction="vertical" size={4}>
                <Text>{risk.description}</Text>
                {risk.mitigation && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    缓解措施：{risk.mitigation}
                  </Text>
                )}
              </Space>
            }
            type={alertType}
            showIcon
          />
        </List.Item>
      )}
    />
  );

  return (
    <Card
      title={
        <Space>
          <span>⚠️ 风险识别汇总</span>
          <Tag color="error">{highRisks.length} 高风险</Tag>
          <Tag color="warning">{mediumRisks.length} 中风险</Tag>
          <Tag color="success">{lowRisks.length} 低风险</Tag>
        </Space>
      }
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {highRisks.length > 0 && (
          <div>
            <Text strong style={{ color: '#ff4d4f' }}>
              🔴 高风险（需重点关注）
            </Text>
            {renderRiskList(highRisks, 'error')}
          </div>
        )}

        {mediumRisks.length > 0 && (
          <div>
            <Text strong style={{ color: '#faad14' }}>
              🟡 中风险（需留意）
            </Text>
            {renderRiskList(mediumRisks, 'warning')}
          </div>
        )}

        {lowRisks.length > 0 && (
          <div>
            <Text strong style={{ color: '#52c41a' }}>
              🟢 低风险（可控）
            </Text>
            {renderRiskList(lowRisks, 'info')}
          </div>
        )}
      </Space>
    </Card>
  );
};

export default RiskAlertPanel;
