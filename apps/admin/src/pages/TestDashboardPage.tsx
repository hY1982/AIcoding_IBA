import React, { useState } from 'react';
import { Divider, Row, Col, Space, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { TestScenario } from '@/types/test-dashboard';
import { modules } from '@/data/test-scenarios';
import OverallProgress from '@/components/test-dashboard/OverallProgress';
import ModuleProgressCard from '@/components/test-dashboard/ModuleProgressCard';
import TestScenarioList from '@/components/test-dashboard/TestScenarioList';
import TestScenarioDetail from '@/components/test-dashboard/TestScenarioDetail';
import RiskAlertPanel from '@/components/test-dashboard/RiskAlertPanel';

/**
 * 集成测试仪表板主页面
 *
 * 面向非技术人员的可视化测试报告界面，整合所有子组件：
 * - OverallProgress: 项目总进度概览
 * - ModuleProgressCard: 各模块完成度卡片
 * - TestScenarioList: 测试场景列表（可筛选、搜索）
 * - TestScenarioDetail: 场景详情抽屉
 * - RiskAlertPanel: 风险识别汇总
 */

const { Title } = Typography;

const TestDashboardPage: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [listModuleFilter, setListModuleFilter] = useState<string | null>(null);

  const handleSelectScenario = (scenario: TestScenario) => {
    setSelectedScenario(scenario);
    setDetailVisible(true);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedScenario(null);
  };

  const handleModuleClick = (moduleId: string) => {
    setListModuleFilter(moduleId);
    // Scroll to scenario list
    const el = document.getElementById('scenario-list-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <Title level={3}>
        <ExperimentOutlined style={{ marginRight: 12 }} />
        篮球匹配平台 — 集成测试仪表板
      </Title>

      {/* 总进度概览 */}
      <OverallProgress />

      <Divider />

      {/* 模块进度卡片 */}
      <div>
        <Title level={4}>模块完成度</Title>
        <Row gutter={[16, 16]}>
          {modules.map((module) => (
            <Col xs={24} sm={12} lg={8} key={module.id}>
              <ModuleProgressCard module={module} onClick={handleModuleClick} />
            </Col>
          ))}
        </Row>
      </div>

      <Divider />

      {/* 测试场景列表 */}
      <div id="scenario-list-section">
        <Title level={4}>测试场景列表</Title>
        <TestScenarioList
          onSelectScenario={handleSelectScenario}
          initialModuleId={listModuleFilter}
        />
      </div>

      <Divider />

      {/* 风险识别 */}
      <RiskAlertPanel />

      {/* 场景详情抽屉 */}
      <TestScenarioDetail
        scenario={selectedScenario}
        visible={detailVisible}
        onClose={handleCloseDetail}
      />
    </Space>
  );
};

export default TestDashboardPage;
