import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Space, Typography, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ShopOutlined,
  TrophyOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

/**
 * 管理后台布局组件
 *
 * 提供侧边导航、顶部用户信息、登出功能。
 * 未登录用户会被重定向到登录页（由路由守卫处理）。
 */
const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '数据概览',
    },
    {
      key: '/players',
      icon: <TeamOutlined />,
      label: '球员管理',
    },
    {
      key: '/venues',
      icon: <ShopOutlined />,
      label: '场地管理',
    },
    {
      key: '/matches',
      icon: <TrophyOutlined />,
      label: '比赛管理',
    },
    {
      key: '/system-params',
      icon: <SettingOutlined />,
      label: '系统参数',
    },
    { type: 'divider' },
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

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 4 }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Space>
            <Avatar icon={<UserOutlined />} />
            <Text>{user?.nickname || '管理员'}</Text>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<LogoutOutlined />}>
                退出
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
