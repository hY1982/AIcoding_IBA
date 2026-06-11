import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ChipMultiSelect } from '../ChipMultiSelect';

interface TestItem {
  id: number;
  name: string;
}

const mockItems: TestItem[] = [
  { id: 1, name: '深圳湾体育中心' },
  { id: 2, name: '福田体育公园' },
  { id: 3, name: '南山文体中心' },
  { id: 4, name: '宝安体育馆' },
];

describe('ChipMultiSelect', () => {
  const defaultProps = {
    items: mockItems,
    selectedItems: [] as TestItem[],
    keyExtractor: (item: TestItem) => item.id,
    labelExtractor: (item: TestItem) => item.name,
    onSelectionChange: jest.fn(),
    maxSelection: 3,
    label: '选择场地',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all available items', () => {
    render(<ChipMultiSelect {...defaultProps} />);

    expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    expect(screen.getByText('福田体育公园')).toBeTruthy();
    expect(screen.getByText('南山文体中心')).toBeTruthy();
    expect(screen.getByText('宝安体育馆')).toBeTruthy();
  });

  it('should render section label', () => {
    render(<ChipMultiSelect {...defaultProps} />);

    expect(screen.getByText('选择场地')).toBeTruthy();
  });

  it('should call onSelectionChange when chip is pressed to select', () => {
    const onSelectionChange = jest.fn();
    render(<ChipMultiSelect {...defaultProps} onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByText('深圳湾体育中心'));

    expect(onSelectionChange).toHaveBeenCalledWith([mockItems[0]]);
  });

  it('should call onSelectionChange when chip is pressed to deselect', () => {
    const onSelectionChange = jest.fn();
    render(
      <ChipMultiSelect
        {...defaultProps}
        selectedItems={[mockItems[0], mockItems[1]]}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.press(screen.getByText('深圳湾体育中心'));

    expect(onSelectionChange).toHaveBeenCalledWith([mockItems[1]]);
  });

  it('should disable unselected chips when maxSelection reached', () => {
    render(
      <ChipMultiSelect
        {...defaultProps}
        selectedItems={[mockItems[0], mockItems[1], mockItems[2]]}
      />,
    );

    const unselectedChip = screen.getByLabelText('宝安体育馆');
    expect(unselectedChip.props.accessibilityState?.disabled).toBe(true);
  });

  it('should show priority numbers for selected items', () => {
    render(
      <ChipMultiSelect
        {...defaultProps}
        selectedItems={[mockItems[0], mockItems[1]]}
      />,
    );

    expect(screen.getByText('1. 深圳湾体育中心')).toBeTruthy();
    expect(screen.getByText('2. 福田体育公园')).toBeTruthy();
  });

  it('should move item up in priority', () => {
    const onSelectionChange = jest.fn();
    render(
      <ChipMultiSelect
        {...defaultProps}
        selectedItems={[mockItems[0], mockItems[1]]}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('上移福田体育公园'));

    expect(onSelectionChange).toHaveBeenCalledWith([mockItems[1], mockItems[0]]);
  });

  it('should move item down in priority', () => {
    const onSelectionChange = jest.fn();
    render(
      <ChipMultiSelect
        {...defaultProps}
        selectedItems={[mockItems[0], mockItems[1]]}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('下移深圳湾体育中心'));

    expect(onSelectionChange).toHaveBeenCalledWith([mockItems[1], mockItems[0]]);
  });

  it('should display error message when provided', () => {
    render(<ChipMultiSelect {...defaultProps} error="请至少选择一个场地" />);

    expect(screen.getByText('请至少选择一个场地')).toBeTruthy();
  });
});
