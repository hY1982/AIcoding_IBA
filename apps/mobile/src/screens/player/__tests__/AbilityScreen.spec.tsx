import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AbilityScreen } from '../AbilityScreen';
import type { PlayerAbility } from '@shared/player';

const mockAbility: PlayerAbility = {
  baseAbilityScore: 72.5,
  matchAdjustValue: 2.0,
  totalAbilityScore: 74.5,
};

describe('AbilityScreen', () => {
  it('should render all ability score fields', () => {
    render(<AbilityScreen ability={mockAbility} />);

    expect(screen.getByLabelText('基础能力值')).toBeTruthy();
    expect(screen.getByLabelText('比赛调节值')).toBeTruthy();
    expect(screen.getByLabelText('综合能力值')).toBeTruthy();
  });

  it('should display correct ability values', () => {
    render(<AbilityScreen ability={mockAbility} />);

    expect(screen.getByText('72.5')).toBeTruthy();
    expect(screen.getByText('+2.0')).toBeTruthy();
    expect(screen.getByText('74.5')).toBeTruthy();
  });

  it('should display negative adjust value correctly', () => {
    const negativeAbility: PlayerAbility = {
      baseAbilityScore: 75.0,
      matchAdjustValue: -3.0,
      totalAbilityScore: 72.0,
    };

    render(<AbilityScreen ability={negativeAbility} />);

    expect(screen.getByText('75.0')).toBeTruthy();
    expect(screen.getByText('-3.0')).toBeTruthy();
    expect(screen.getByText('72.0')).toBeTruthy();
  });

  it('should render explanation text', () => {
    render(<AbilityScreen ability={mockAbility} />);

    expect(screen.getByText('基础能力值')).toBeTruthy();
    expect(screen.getByText('比赛调节值')).toBeTruthy();
    expect(screen.getByText('综合能力值')).toBeTruthy();
  });

  it('should render empty state when no ability data', () => {
    render(<AbilityScreen />);

    expect(screen.getByText('暂无能力值数据')).toBeTruthy();
  });

  it('should have accessibility labels on all score displays', () => {
    render(<AbilityScreen ability={mockAbility} />);

    expect(screen.getByLabelText('基础能力值')).toBeTruthy();
    expect(screen.getByLabelText('比赛调节值')).toBeTruthy();
    expect(screen.getByLabelText('综合能力值')).toBeTruthy();
  });

  it('should display positive adjust value with plus sign', () => {
    render(<AbilityScreen ability={mockAbility} />);

    expect(screen.getByText('+2.0')).toBeTruthy();
  });
});
