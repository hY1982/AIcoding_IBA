import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  DatabaseOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { ProcessStep } from '@/types/acceptance-demo';

interface StepSummaryCardProps {
  step: ProcessStep;
}

const StepSummaryCard: React.FC<StepSummaryCardProps> = ({ step }) => {
  const tableCount = step.tables.length;
  const constraintCount = step.tables.reduce(
    (sum, t) => sum + t.constraints.length,
    0
  );
  const criteriaCount = step.acceptanceCriteria.length;
  const testCount = step.testItems.length;

  return (
    <Card style={{ marginBottom: 24 }}>
      <Row gutter={[24, 16]}>
        <Col xs={12} sm={6}>
          <Statistic
            title="涉及数据表"
            value={tableCount}
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="数据库约束"
            value={constraintCount}
            prefix={<SafetyCertificateOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="验收标准"
            value={criteriaCount}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="测试项"
            value={testCount}
            prefix={<ExperimentOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default StepSummaryCard;
