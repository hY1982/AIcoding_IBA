import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Button, Space, Typography, message } from 'antd';
import { getSystemParams, updateSystemParam } from '@/api/admin';
import type { SystemParam } from '@shared/system';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 系统参数管理页面
 *
 * 展示系统参数列表，支持 JSON 格式编辑和更新。
 */
const SystemParamsPage: React.FC = () => {
  const [params, setParams] = useState<SystemParam[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchParams = async () => {
    setLoading(true);
    try {
      const data = await getSystemParams();
      setParams(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParams();
  }, []);

  const handleEdit = (param: SystemParam) => {
    setEditingKey(param.paramKey);
    setEditValue(JSON.stringify(param.paramValue, null, 2));
    setEditDescription(param.description || '');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
    setEditDescription('');
  };

  const handleSave = async (paramKey: string) => {
    try {
      const parsedValue = JSON.parse(editValue);
      await updateSystemParam(paramKey, {
        paramValue: parsedValue,
        description: editDescription,
      });
      message.success('参数更新成功');
      setEditingKey(null);
      fetchParams();
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('JSON 格式错误，请检查输入');
      } else {
        message.error('更新失败');
      }
    }
  };

  const columns = [
    {
      title: '参数键',
      dataIndex: 'paramKey',
      key: 'paramKey',
      width: 200,
    },
    {
      title: '参数值',
      key: 'paramValue',
      render: (_: unknown, record: SystemParam) => {
        if (editingKey === record.paramKey) {
          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              <TextArea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={8}
                style={{ fontFamily: 'monospace', minWidth: 400 }}
              />
              <Text type="secondary">JSON 格式</Text>
            </Space>
          );
        }
        return (
          <pre style={{ margin: 0, maxWidth: 400, overflow: 'auto' }}>
            {JSON.stringify(record.paramValue, null, 2)}
          </pre>
        );
      },
    },
    {
      title: '描述',
      key: 'description',
      render: (_: unknown, record: SystemParam) => {
        if (editingKey === record.paramKey) {
          return (
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="参数描述"
            />
          );
        }
        return record.description || '-';
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: SystemParam) => {
        if (editingKey === record.paramKey) {
          return (
            <Space>
              <Button type="primary" size="small" onClick={() => handleSave(record.paramKey)}>
                保存
              </Button>
              <Button size="small" onClick={handleCancel}>
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={3}>系统参数</Title>
      <Card>
        <Table
          columns={columns}
          dataSource={params}
          rowKey="paramKey"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default SystemParamsPage;
