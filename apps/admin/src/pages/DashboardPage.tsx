import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography } from 'antd';
import {
  TeamOutlined,
  ShopOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getStats } from '@/api/admin';
import type { AdminStats } from '@shared/admin';

const { Title } = Typography;

/**
 * 管理后台 Dashboard 页面（关键路径）
 *
 * 展示平台核心数据统计：
 * - 顶部统计卡片：总球员数、总场地数、今日比赛数、待处理意向数
 * - 中部：近7天比赛趋势
 * - 底部：最近比赛列表
 */
const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getStats();
        setStats(data);
      } catch (err) {
        setError('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <Title level={4}>{error || '暂无数据'}</Title>
      </Card>
    );
  }

  return (
    <div>
      <Title level={3}>数据概览</Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总注册球员"
              value={stats.totalPlayers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总场地数"
              value={stats.totalVenues}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日比赛"
              value={stats.todayMatches}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理意向"
              value={stats.pendingIntentions}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 近7天比赛趋势 */}
      <Card title="近7天比赛趋势" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {stats.weeklyMatchTrend.map((item) => (
            <Col key={item.date} span={3}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                  {item.count}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{item.date}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 比赛状态分布 */}
      <Card title="比赛状态分布" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {stats.matchStatusDistribution.map((item) => (
            <Col key={item.status} span={4}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{item.count}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{item.status}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default DashboardPage;
