import React, { useState } from 'react';
import { Card, Checkbox, List, Typography, Space, Tag, Progress } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { AcceptanceCriterion } from '@/types/acceptance-demo';
import { CRITERIA_CATEGORY_LABELS } from '@/types/acceptance-demo';

interface AcceptanceChecklistProps {
  criteria: AcceptanceCriterion[];
}

const AcceptanceChecklist: React.FC<AcceptanceChecklistProps> = ({ criteria }) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(criteria.filter((c) => c.checked).map((c) => c.id))
  );

  const handleToggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const businessCriteria = criteria.filter((c) => c.category === 'business');
  const databaseCriteria = criteria.filter((c) => c.category === 'database');

  const renderList = (items: AcceptanceCriterion[], title: string, color: string) => {
    const checked = items.filter((c) => checkedIds.has(c.id)).length;
    return (
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
          <Tag color={color}>
            {checked}/{items.length}
          </Tag>
        </Space>
        <List
          size="small"
          bordered
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              style={{
                backgroundColor: checkedIds.has(item.id) ? '#f6ffed' : undefined,
              }}
            >
              <Checkbox
                checked={checkedIds.has(item.id)}
                onChange={() => handleToggle(item.id)}
                style={{ width: '100%' }}
              >
                <Typography.Text
                  style={{
                    textDecoration: checkedIds.has(item.id) ? 'line-through' : undefined,
                    color: checkedIds.has(item.id) ? '#52c41a' : undefined,
                  }}
                >
                  {item.description}
                </Typography.Text>
              </Checkbox>
            </List.Item>
          )}
        />
      </div>
    );
  };

  const totalChecked = checkedIds.size;
  const totalCount = criteria.length;
  const percent = Math.round((totalChecked / totalCount) * 100);

  return (
    <Card
      title={
        <Space>
          <CheckCircleOutlined />
          <Typography.Text strong>验收标准清单</Typography.Text>
          <Tag color={percent === 100 ? 'success' : 'processing'}>
            {totalChecked}/{totalCount}
          </Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Progress
        percent={percent}
        status={percent === 100 ? 'success' : 'active'}
        style={{ marginBottom: 16 }}
      />
      {renderList(businessCriteria, CRITERIA_CATEGORY_LABELS.business, 'blue')}
      {renderList(databaseCriteria, CRITERIA_CATEGORY_LABELS.database, 'purple')}
    </Card>
  );
};

export default AcceptanceChecklist;
