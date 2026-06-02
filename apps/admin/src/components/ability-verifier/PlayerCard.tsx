import React from 'react';
import { Card, Tag, Typography, Row, Col, Divider, Progress, Tooltip as AntTooltip } from 'antd';
import {
  ManOutlined,
  WomanOutlined,
  TrophyOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { TestPlayer } from '@/data/ability-test-players';
import {
  calculateBaseAbility,
  getScoreColor,
  getScoreLabel,
  type AttributeBreakdown,
} from '@/lib/ability-calculation';
import { AbilityRadarChart, type RadarDataItem } from './AbilityRadarChart';

const { Text, Title } = Typography;

interface PlayerCardProps {
  player: TestPlayer;
}

const categoryColors: Record<string, string> = {
  '极值': 'red',
  '平均': 'blue',
  '单项突出': 'green',
  '单项薄弱': 'orange',
  '特殊组合': 'purple',
};

export const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
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

  const scoreColor = getScoreColor(result.score);
  const scoreLabel = getScoreLabel(result.score);

  // 原始值雷达图数据
  const rawRadarData: RadarDataItem[] = result.breakdown.map((item) => ({
    subject: item.name,
    value: Math.round(item.rawValue),
    fullMark: getFullMark(item.name),
  }));

  // 百分位雷达图数据
  const percentileRadarData: RadarDataItem[] = result.breakdown.map((item) => ({
    subject: item.name,
    value: Math.round(item.percentile),
    fullMark: 100,
  }));

  // 验证指标
  const validations = getValidations(result.breakdown, result.score);

  return (
    <Card
      hoverable
      style={{ marginBottom: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level={5} style={{ margin: 0 }}>
            {player.name}
          </Title>
          <Tag color={player.gender === 'male' ? 'blue' : 'magenta'}>
            {player.gender === 'male' ? <ManOutlined /> : <WomanOutlined />}
            {player.gender === 'male' ? ' 男' : ' 女'}
          </Tag>
          <Tag color={categoryColors[player.category] || 'default'}>
            {player.category}
          </Tag>
        </div>
      }
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrophyOutlined style={{ color: scoreColor, fontSize: 18 }} />
          <Title level={3} style={{ margin: 0, color: scoreColor }}>
            {result.score}
          </Title>
          <Tag color={scoreColor} style={{ fontSize: 14, fontWeight: 'bold' }}>
            {scoreLabel}
          </Tag>
        </div>
      }
    >
      {/* 描述 */}
      <Text type="secondary">
        <InfoCircleOutlined style={{ marginRight: 4 }} />
        {player.description}
      </Text>

      <Divider style={{ margin: '12px 0' }} />

      {/* 雷达图 */}
      <Row gutter={16}>
        <Col span={12}>
          <AbilityRadarChart
            data={rawRadarData}
            title="原始属性值"
            color="#1890ff"
            fillColor="rgba(24, 144, 255, 0.15)"
          />
        </Col>
        <Col span={12}>
          <AbilityRadarChart
            data={percentileRadarData}
            title="百分位排名"
            color="#52c41a"
            fillColor="rgba(82, 196, 26, 0.15)"
          />
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      {/* 权重分解 */}
      <Title level={5} style={{ marginBottom: 12 }}>
        权重贡献分解
      </Title>
      <Row gutter={[8, 8]}>
        {result.breakdown.map((item) => (
          <Col span={12} key={item.name}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text>{item.name}</Text>
                <Text type="secondary">
                  {item.rawValue} → {Math.round(item.percentile)}%
                </Text>
              </div>
              <AntTooltip
                title={`权重 ${(item.weight * 100).toFixed(0)}%，贡献 ${item.contribution.toFixed(2)} 分`}
              >
                <Progress
                  percent={Math.round(item.percentile)}
                  size="small"
                  strokeColor={getPercentileColor(item.percentile)}
                  showInfo={false}
                />
              </AntTooltip>
            </div>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      {/* 验证指标 */}
      <Title level={5} style={{ marginBottom: 12 }}>
        验证指标
      </Title>
      <Row gutter={[8, 8]}>
        {validations.map((v) => (
          <Col span={8} key={v.label}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {v.label}
              </Text>
              <div>
                <Tag color={v.passed ? 'success' : 'error'}>
                  {v.passed ? '通过' : '未通过'}
                </Tag>
              </div>
              <Text style={{ fontSize: 12 }}>{v.detail}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

function getFullMark(attributeName: string): number {
  const marks: Record<string, number> = {
    '身高': 230,
    '体重': 130,
    '臂展': 230,
    '站立摸高': 270,
    '弹跳摸高': 360,
    '球龄': 15,
    '年龄': 45,
  };
  return marks[attributeName] || 100;
}

function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return '#faad14';
  if (percentile >= 70) return '#52c41a';
  if (percentile >= 50) return '#1890ff';
  if (percentile >= 30) return '#fa8c16';
  return '#f5222d';
}

interface ValidationItem {
  label: string;
  passed: boolean;
  detail: string;
}

function getValidations(breakdown: AttributeBreakdown[], totalScore: number): ValidationItem[] {
  const validations: ValidationItem[] = [];

  // 权重和检查
  const weightSum = breakdown.reduce((sum, item) => sum + item.weight, 0);
  validations.push({
    label: '权重和',
    passed: Math.abs(weightSum - 1.0) < 0.01,
    detail: `${weightSum.toFixed(2)} ≈ 1.0`,
  });

  // 分数范围检查
  validations.push({
    label: '分数范围',
    passed: totalScore >= 0 && totalScore <= 100,
    detail: `${totalScore} ∈ [0, 100]`,
  });

  // 贡献和检查
  const contributionSum = breakdown.reduce((sum, item) => sum + item.contribution, 0);
  validations.push({
    label: '贡献和',
    passed: Math.abs(contributionSum - totalScore) < 0.1,
    detail: `${contributionSum.toFixed(2)} ≈ ${totalScore}`,
  });

  return validations;
}

export default PlayerCard;
