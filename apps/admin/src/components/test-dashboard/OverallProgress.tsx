import React from 'react';
import { Card, Col, Progress, Row, Space, Statistic } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { getModuleStats, getScenarioStats, getRiskSummary } from '@/data/test-scenarios';

/**
 * 总进度概览
 *
 * 展示项目整体完成度统计，包括：
 * - 4 个核心统计卡片（总模块数、已完成模块、待开发场景、风险点数量）
 * - Phase 级别进度条（Phase 0 ~ Phase 7）
 */

const OverallProgress: React.FC = () => {
  const moduleStats = getModuleStats();
  const scenarioStats = getScenarioStats();
  const riskStats = getRiskSummary();

  const phaseProgress = [
    { name: 'Phase 0: 基础设施', percent: 100, status: 'success' as const },
    { name: 'Phase 1: 数据层', percent: 100, status: 'success' as const },
    { name: 'Phase 2: Service层', percent: 5, status: 'active' as const },
    { name: 'Phase 3: API接口', percent: 0, status: 'exception' as const },
    { name: 'Phase 4: WebSocket', percent: 0, status: 'exception' as const },
    { name: 'Phase 5: 前端页面', percent: 0, status: 'exception' as const },
    { name: 'Phase 6: 部署运维', percent: 0, status: 'exception' as const },
    { name: 'Phase 7: 可观测性', percent: 0, status: 'exception' as const },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 核心统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="总模块数"
              value={moduleStats.total}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="已完成模块"
              value={moduleStats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={`/ ${moduleStats.total}`}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="待开发场景"
              value={scenarioStats.pendingDev + scenarioStats.blocked + scenarioStats.pendingApi}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
              suffix={`/ ${scenarioStats.total}`}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="风险点"
              value={riskStats.total}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              suffix={`(高:${riskStats.high})`}
            />
          </Card>
        </Col>
      </Row>

      {/* Phase 进度条 */}
      <Card title="开发阶段进度" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          {phaseProgress.map((phase) => (
            <div key={phase.name}>
              <div style={{ marginBottom: 4, fontSize: 13 }}>{phase.name}</div>
              <Progress
                percent={phase.percent}
                size="small"
                status={phase.status}
                format={(percent) => `${percent}%`}
              />
            </div>
          ))}
        </Space>
      </Card>
    </Space>
  );
};

export default OverallProgress;
