import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Sider, Header, Content } = Layout;

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/test-dashboard',
      icon: <ExperimentOutlined />,
      label: '集成测试',
    },
    {
      key: '/acceptance-demo',
      icon: <CheckCircleOutlined />,
      label: '验收演示',
    },
    {
      key: '/ability-verifier',
      icon: <BarChartOutlined />,
      label: '能力值验证',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)' }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff' }} />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
