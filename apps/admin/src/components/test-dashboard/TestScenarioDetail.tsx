import React from 'react';
import {
  Alert,
  Collapse,
  Descriptions,
  Drawer,
  List,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import type { TestScenario } from '@/types/test-dashboard';
import StatusBadge from './StatusBadge';

/**
 * 场景详情抽屉
 *
 * 点击场景行后弹出的详情面板，展示：
 * - 场景基本信息（Descriptions）
 * - 测试数据准备（Collapse）
 * - 执行步骤（Steps）
 * - 预期结果
 * - 验收标准（带勾选框样式的列表）
 * - 风险点（Alert）
 */

interface TestScenarioDetailProps {
  scenario: TestScenario | null;
  visible: boolean;
  onClose: () => void;
}

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const TestScenarioDetail: React.FC<TestScenarioDetailProps> = ({
  scenario,
  visible,
  onClose,
}) => {
  if (!scenario) return null;

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0}>
          <Space>
            <Tag style={{ fontFamily: 'monospace' }}>{scenario.id}</Tag>
            <StatusBadge status={scenario.status} type="scenario" />
            <StatusBadge status={scenario.completionStatus} type="module" />
          </Space>
          <Text strong style={{ fontSize: 16, marginTop: 8 }}>
            {scenario.name}
          </Text>
        </Space>
      }
      placement="right"
      width={680}
      onClose={onClose}
      open={visible}
      bodyStyle={{ paddingBottom: 24 }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 基本信息 */}
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="所属模块">
            {scenario.moduleId} {scenario.module}
          </Descriptions.Item>
          <Descriptions.Item label="相关数据表">
            <Space size={[4, 4]} wrap>
              {scenario.relatedEntities.map((entity) => (
                <Tag key={entity}>
                  {entity}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
          {scenario.notes && (
            <Descriptions.Item label="备注">
              <Text type="secondary">{scenario.notes}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* 测试数据准备 */}
        {scenario.testData.length > 0 && (
          <div>
            <Title level={5}>测试数据准备</Title>
            <Collapse size="small">
              {scenario.testData.map((data) => (
                <Panel
                  header={`步骤 ${data.step}: ${data.description}`}
                  key={data.step}
                >
                  {data.sampleData && (
                    <pre
                      style={{
                        background: '#f6f8fa',
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 12,
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(data.sampleData, null, 2)}
                    </pre>
                  )}
                  {data.sqlTemplate && (
                    <>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        SQL 参考（技术人员）：
                      </Text>
                      <pre
                        style={{
                          background: '#f6f8fa',
                          padding: 12,
                          borderRadius: 6,
                          fontSize: 12,
                          overflow: 'auto',
                        }}
                      >
                        {data.sqlTemplate}
                      </pre>
                    </>
                  )}
                </Panel>
              ))}
            </Collapse>
          </div>
        )}

        {/* 执行步骤 */}
        <div>
          <Title level={5}>执行步骤</Title>
          <Steps
            direction="vertical"
            size="small"
            current={-1}
            items={scenario.executionSteps.map((step) => ({
              title: step,
            }))}
          />
        </div>

        {/* 预期结果 */}
        <div>
          <Title level={5}>预期结果</Title>
          <Paragraph style={{ background: '#f6ffed', padding: 12, borderRadius: 6 }}>
            {scenario.expectedResult}
          </Paragraph>
        </div>

        {/* 验收标准 */}
        <div>
          <Title level={5}>验收标准</Title>
          <List
            size="small"
            bordered
            dataSource={scenario.acceptanceCriteria}
            renderItem={(item) => (
              <List.Item>
                <Text>
                  <span style={{ marginRight: 8 }}>☐</span>
                  {item}
                </Text>
              </List.Item>
            )}
          />
        </div>

        {/* 风险点 */}
        {scenario.risks.length > 0 && (
          <div>
            <Title level={5}>风险识别</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {scenario.risks.map((risk, index) => (
                <Alert
                  key={index}
                  message={
                    <Space>
                      <StatusBadge status={risk.level} type="risk" />
                      <Text strong>风险 {index + 1}</Text>
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
                  type={
                    risk.level === 'high'
                      ? 'error'
                      : risk.level === 'medium'
                        ? 'warning'
                        : 'info'
                  }
                  showIcon
                />
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Drawer>
  );
};

export default TestScenarioDetail;
