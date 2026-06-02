import React from 'react';
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Typography } from 'antd';

const { Text } = Typography;

export interface RadarDataItem {
  subject: string;
  value: number;
  fullMark: number;
}

interface AbilityRadarChartProps {
  data: RadarDataItem[];
  title: string;
  color?: string;
  fillColor?: string;
  showTooltip?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RadarDataItem;
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Text strong>{label}</Text>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary">数值: </Text>
          <Text>{data.value}</Text>
        </div>
        <div>
          <Text type="secondary">满分: </Text>
          <Text>{data.fullMark}</Text>
        </div>
      </div>
    );
  }
  return null;
};

export const AbilityRadarChart: React.FC<AbilityRadarChartProps> = ({
  data,
  title,
  color = '#1890ff',
  fillColor = 'rgba(24, 144, 255, 0.2)',
  showTooltip = true,
}) => {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <Text strong style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e8e8e8" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 12, fill: '#595959' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 'auto']}
            tick={{ fontSize: 10, fill: '#8c8c8c' }}
            tickCount={5}
          />
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          <Radar
            name={title}
            dataKey="value"
            stroke={color}
            fill={fillColor}
            fillOpacity={1}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AbilityRadarChart;
