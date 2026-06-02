import React from 'react';
import { Card, Progress, Space, Tag } from 'antd';
import type { ModuleDef } from '@/types/test-dashboard';
import StatusBadge from './StatusBadge';

/**
 * 模块进度卡片
 *
 * 展示单个模块的完成度概览，包括：
 * - 模块名称和 ID
 * - 完成状态标签
 * - 可测试场景数 / 总场景数
 * - 进度条（可测试比例）
 * - 相关数据库表标签
 */

interface ModuleProgressCardProps {
  module: ModuleDef;
  onClick?: (moduleId: string) => void;
}

const ModuleProgressCard: React.FC<ModuleProgressCardProps> = ({ module, onClick }) => {
  const percent =
    module.totalScenarios > 0
      ? Math.round((module.testableScenarios / module.totalScenarios) * 100)
      : 0;

  return (
    <Card
      hoverable={!!onClick}
      onClick={() => onClick?.(module.id)}
      title={
        <Space>
          <strong>{module.id}</strong>
          <span>{module.name}</span>
          <StatusBadge status={module.status} type="module" />
        </Space>
      }
      size="small"
      style={{ height: '100%' }}
    >
      <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
        {module.description}
      </p>

      <Progress
        percent={percent}
        size="small"
        status={percent === 100 ? 'success' : 'active'}
        format={() => `${module.testableScenarios}/${module.totalScenarios} 可测试`}
      />

      <div style={{ marginTop: 8 }}>
        <Space size={[4, 4]} wrap>
          {module.entityNames.map((entity) => (
            <Tag key={entity} style={{ fontSize: 12 }}>
              {entity}
            </Tag>
          ))}
        </Space>
      </div>
    </Card>
  );
};

export default ModuleProgressCard;
