import React, { useState } from 'react';
import {
  Typography,
  Space,
  Divider,
  Tabs,
  Timeline,
  Alert,
  Card,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  PlayCircleOutlined,
  DatabaseOutlined,
  TableOutlined,
  SafetyCertificateOutlined,
  NodeIndexOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { processSteps, globalEntityRelations } from '@/data/acceptance-demo';
import ProcessSteps from '@/components/acceptance-demo/ProcessSteps';
import StepSummaryCard from '@/components/acceptance-demo/StepSummaryCard';
import TableSchemaCard from '@/components/acceptance-demo/TableSchemaCard';
import SampleDataTable from '@/components/acceptance-demo/SampleDataTable';
import ConstraintPanel from '@/components/acceptance-demo/ConstraintPanel';
import StatusFlowDiagram from '@/components/acceptance-demo/StatusFlowDiagram';
import AcceptanceChecklist from '@/components/acceptance-demo/AcceptanceChecklist';
import TestCategoryTabs from '@/components/acceptance-demo/TestCategoryTabs';
import EntityRelationGraph from '@/components/acceptance-demo/EntityRelationGraph';

const AcceptanceDemoPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = processSteps[currentStep];

  const allConstraints = step.tables.flatMap((t) => t.constraints);

  const tabItems = [
    {
      key: 'schema',
      label: (
        <Space>
          <DatabaseOutlined />
          表结构
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {step.tables.map((table) => (
            <TableSchemaCard key={table.name} schema={table} />
          ))}
        </Space>
      ),
    },
    {
      key: 'data',
      label: (
        <Space>
          <TableOutlined />
          示例数据
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(step.sampleData).map(([tableName, records]) => (
            <SampleDataTable
              key={tableName}
              tableName={tableName}
              records={records}
            />
          ))}
        </Space>
      ),
    },
    {
      key: 'constraints',
      label: (
        <Space>
          <SafetyCertificateOutlined />
          约束详情
        </Space>
      ),
      children: <ConstraintPanel constraints={allConstraints} />,
    },
    {
      key: 'status',
      label: (
        <Space>
          <NodeIndexOutlined />
          状态流转
        </Space>
      ),
      children: <StatusFlowDiagram flows={step.statusFlows || []} />,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          端到端验收演示
        </Typography.Title>
        <Typography.Text type="secondary">
          从球员注册到赛后反馈的完整业务流程数据流转展示
        </Typography.Text>
      </div>

      {/* 全局提示 */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="使用说明"
        description="点击上方流程步骤可切换不同业务环节，每个环节展示涉及的数据库表结构、示例数据、约束定义和状态流转。下方验收标准清单可勾选以跟踪验收进度。"
      />

      {/* 9步流程步骤条 */}
      <ProcessSteps
        steps={processSteps}
        current={currentStep}
        onChange={setCurrentStep}
      />

      {/* 当前步骤标题和描述 */}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Typography.Text code style={{ fontSize: 16 }}>
              {step.id}
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {step.title}
            </Typography.Title>
            <Tag color="blue">{step.actor}</Tag>
          </Space>
          <Typography.Text style={{ fontSize: 14 }}>
            {step.description}
          </Typography.Text>
        </Space>
      </Card>

      {/* 步骤摘要统计 */}
      <StepSummaryCard step={step} />

      {/* 业务流转流程 */}
      <Card
        title={
          <Space>
            <PlayCircleOutlined />
            <Typography.Text strong>业务流程</Typography.Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Timeline
          items={step.businessFlow.map((text, i) => ({
            children: (
              <Typography.Text
                style={{
                  fontSize: 13,
                  color: i === step.businessFlow.length - 1 ? '#52c41a' : undefined,
                }}
              >
                {text}
              </Typography.Text>
            ),
          }))}
        />
      </Card>

      {/* 实体关系图 */}
      <EntityRelationGraph
        relations={globalEntityRelations}
        tables={step.tables}
      />

      <Divider />

      {/* Tabs: 表结构 | 示例数据 | 约束详情 | 状态流转 */}
      <Tabs defaultActiveKey="schema" items={tabItems} type="card" />

      <Divider />

      {/* 验收标准清单 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <AcceptanceChecklist criteria={step.acceptanceCriteria} />
        </Col>
        <Col xs={24} lg={12}>
          <TestCategoryTabs testItems={step.testItems} />
        </Col>
      </Row>
    </Space>
  );
};

export default AcceptanceDemoPage;
