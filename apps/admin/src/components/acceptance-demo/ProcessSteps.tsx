import React from 'react';
import { Steps } from 'antd';
import type { ProcessStep } from '@/types/acceptance-demo';

interface ProcessStepsProps {
  steps: ProcessStep[];
  current: number;
  onChange: (index: number) => void;
}

const ProcessSteps: React.FC<ProcessStepsProps> = ({ steps, current, onChange }) => {
  return (
    <Steps
      current={current}
      onChange={onChange}
      direction="horizontal"
      size="small"
      items={steps.map((step) => ({
        title: step.title,
        description: step.actor,
      }))}
      style={{ marginBottom: 24, overflowX: 'auto' }}
    />
  );
};

export default ProcessSteps;
