import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { apiClient } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';

const { Title } = Typography;

/**
 * 管理员登录页面
 *
 * 复用后端 /auth/login 接口，登录成功后校验管理员权限。
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: { phone: string; password: string }) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: 调用登录接口
      const loginResponse = await apiClient.post('/auth/login', {
        phone: values.phone,
        password: values.password,
      });

      const { user, tokens } = loginResponse.data.data;

      // Step 2: 校验管理员权限（调用 /admin/stats）
      // 使用请求级 header，避免污染全局 axios 实例
      await apiClient.get('/admin/stats', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      // Step 3: 登录成功，保存状态
      login(tokens.accessToken, user);
      navigate('/');
    } catch (err: unknown) {
      const axiosError = err as { response?: { status: number; data?: { message?: string } } };
      if (axiosError.response?.status === 403) {
        setError('该账号不是管理员，无权访问管理后台');
      } else if (axiosError.response?.status === 401) {
        setError('手机号或密码错误');
      } else {
        setError(axiosError.response?.data?.message || '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>
              <LoginOutlined style={{ marginRight: 8 }} />
              管理后台登录
            </Title>
            <Typography.Text type="secondary">
              篮球匹配平台管理系统
            </Typography.Text>
          </div>

          {error && (
            <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />
          )}

          <Form
            name="admin-login"
            onFinish={handleSubmit}
            autoComplete="off"
            layout="vertical"
          >
            <Form.Item
              label="手机号"
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
              ]}
            >
              <Input placeholder="请输入管理员手机号" size="large" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
