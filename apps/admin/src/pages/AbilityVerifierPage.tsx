import React, { useMemo, useState } from 'react';
import {
  Typography,
  Row,
  Col,
  Select,
  Card,
  Statistic,
  Tag,
  Space,
  Table,
  Tooltip as AntTooltip,
} from 'antd';
import {
  BarChartOutlined,
  TrophyOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { testPlayers, type TestPlayer } from '@/data/ability-test-players';
import { calculateBaseAbility, getScoreColor } from '@/lib/ability-calculation';
import { PlayerCard } from '@/components/ability-verifier/PlayerCard';

const { Title, Text } = Typography;
const { Option } = Select;

type SortKey = 'score' | 'height' | 'weight' | 'category';

const AbilityVerifierPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('score');

  const categories = useMemo(() => {
    const cats = new Set(testPlayers.map((p) => p.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredPlayers = useMemo(() => {
    let players =
      selectedCategory === 'all'
        ? [...testPlayers]
        : testPlayers.filter((p) => p.category === selectedCategory);

    players.sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = calculateBaseAbility({
          age: a.age,
          basketballAge: a.basketballAge,
          gender: a.gender,
          height: a.height,
          weight: a.weight,
          wingspan: a.wingspan,
          standingReach: a.standingReach,
          jumpingReach: a.jumpingReach,
        }).score;
        const scoreB = calculateBaseAbility({
          age: b.age,
          basketballAge: b.basketballAge,
          gender: b.gender,
          height: b.height,
          weight: b.weight,
          wingspan: b.wingspan,
          standingReach: b.standingReach,
          jumpingReach: b.jumpingReach,
        }).score;
        return scoreB - scoreA;
      }
      if (sortBy === 'height') return b.height - a.height;
      if (sortBy === 'weight') return b.weight - a.weight;
      return a.category.localeCompare(b.category);
    });

    return players;
  }, [selectedCategory, sortBy]);

  // 汇总统计
  const stats = useMemo(() => {
    const results = testPlayers.map((p) =>
      calculateBaseAbility({
        age: p.age,
        basketballAge: p.basketballAge,
        gender: p.gender,
        height: p.height,
        weight: p.weight,
        wingspan: p.wingspan,
        standingReach: p.standingReach,
        jumpingReach: p.jumpingReach,
      }),
    );

    const scores = results.map((r) => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // 验证通过率
    let passCount = 0;
    for (const r of results) {
      const weightSum = r.breakdown.reduce((s, item) => s + item.weight, 0);
      const inRange = r.score >= 0 && r.score <= 100;
      const weightOk = Math.abs(weightSum - 1.0) < 0.01;
      if (inRange && weightOk) passCount++;
    }

    return {
      avgScore: Math.round(avgScore * 100) / 100,
      minScore,
      maxScore,
      passRate: Math.round((passCount / results.length) * 100),
      totalPlayers: testPlayers.length,
    };
  }, []);

  // 对比表格列
  const tableColumns = [
    {
      title: '球员',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, player: TestPlayer) => (
        <Space>
          <Text strong>{player.name}</Text>
          <Tag color={player.gender === 'male' ? 'blue' : 'magenta'}>
            {player.gender === 'male' ? '男' : '女'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '身高',
      dataIndex: 'height',
      key: 'height',
      render: (v: number) => `${v}cm`,
      sorter: (a: TestPlayer, b: TestPlayer) => a.height - b.height,
    },
    {
      title: '体重',
      dataIndex: 'weight',
      key: 'weight',
      render: (v: number) => `${v}kg`,
      sorter: (a: TestPlayer, b: TestPlayer) => a.weight - b.weight,
    },
    {
      title: '臂展',
      dataIndex: 'wingspan',
      key: 'wingspan',
      render: (v: number) => `${v}cm`,
    },
    {
      title: '站立摸高',
      dataIndex: 'standingReach',
      key: 'standingReach',
      render: (v: number) => `${v}cm`,
    },
    {
      title: '弹跳摸高',
      dataIndex: 'jumpingReach',
      key: 'jumpingReach',
      render: (v: number) => `${v}cm`,
    },
    {
      title: '球龄',
      dataIndex: 'basketballAge',
      key: 'basketballAge',
      render: (v: number) => `${v}年`,
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      render: (v: number) => `${v}岁`,
    },
    {
      title: '能力值',
      key: 'score',
      render: (_: unknown, player: TestPlayer) => {
        const result = calculateBaseAbility({
          age: player.age,
          basketballAge: player.basketballAge,
          gender: player.gender,
          height: player.height,
          weight: player.weight,
          wingspan: player.wingspan,
          standingReach: player.standingReach,
          jumpingReach: player.jumpingReach,
        });
        return (
          <AntTooltip
            title={result.breakdown
              .map((b) => `${b.name}: ${b.contribution.toFixed(2)}`)
              .join(' | ')}
          >
            <Tag
              color={getScoreColor(result.score)}
              style={{ fontSize: 14, fontWeight: 'bold', minWidth: 60, textAlign: 'center' }}
            >
              {result.score}
            </Tag>
          </AntTooltip>
        );
      },
      sorter: (a: TestPlayer, b: TestPlayer) => {
        const scoreA = calculateBaseAbility({
          age: a.age,
          basketballAge: a.basketballAge,
          gender: a.gender,
          height: a.height,
          weight: a.weight,
          wingspan: a.wingspan,
          standingReach: a.standingReach,
          jumpingReach: a.jumpingReach,
        }).score;
        const scoreB = calculateBaseAbility({
          age: b.age,
          basketballAge: b.basketballAge,
          gender: b.gender,
          height: b.height,
          weight: b.weight,
          wingspan: b.wingspan,
          standingReach: b.standingReach,
          jumpingReach: b.jumpingReach,
        }).score;
        return scoreA - scoreB;
      },
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          球员能力值计算验证器
        </Title>
        <Text type="secondary">
          用于非技术人员验证基础能力值计算模块的逻辑是否符合预期
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="测试球员总数"
              value={stats.totalPlayers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均能力值"
              value={stats.avgScore}
              precision={2}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: getScoreColor(stats.avgScore) }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="能力值范围"
              value={`${stats.minScore} ~ ${stats.maxScore}`}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="验证通过率"
              value={stats.passRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: stats.passRate === 100 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和排序 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <div>
            <Text strong style={{ marginRight: 8 }}>类别筛选:</Text>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 140 }}
            >
              <Option value="all">全部</Option>
              {categories
                .filter((c) => c !== 'all')
                .map((cat) => (
                  <Option key={cat} value={cat}>
                    {cat}
                  </Option>
                ))}
            </Select>
          </div>
          <div>
            <Text strong style={{ marginRight: 8 }}>排序方式:</Text>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 140 }}
            >
              <Option value="score">能力值</Option>
              <Option value="height">身高</Option>
              <Option value="weight">体重</Option>
              <Option value="category">类别</Option>
            </Select>
          </div>
        </Space>
      </Card>

      {/* 球员卡片列表 */}
      <Row gutter={[16, 16]}>
        {filteredPlayers.map((player) => (
          <Col span={24} key={player.id}>
            <PlayerCard player={player} />
          </Col>
        ))}
      </Row>

      {/* 对比表格 */}
      <Card
        title="球员对比表"
        style={{ marginTop: 24, marginBottom: 24 }}
      >
        <Table
          dataSource={filteredPlayers}
          columns={tableColumns}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default AbilityVerifierPage;
