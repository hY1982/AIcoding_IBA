import React from 'react';
import { Tag } from 'antd';
import type { ConstraintType } from '@/types/acceptance-demo';
import { CONSTRAINT_TYPE_LABELS, CONSTRAINT_TYPE_COLORS } from '@/types/acceptance-demo';

interface ConstraintBadgeProps {
  type: ConstraintType;
}

const ConstraintBadge: React.FC<ConstraintBadgeProps> = ({ type }) => {
  return (
    <Tag
      color={CONSTRAINT_TYPE_COLORS[type]}
      style={{ fontWeight: 600, fontSize: 12 }}
    >
      {CONSTRAINT_TYPE_LABELS[type]}
    </Tag>
  );
};

export default ConstraintBadge;
