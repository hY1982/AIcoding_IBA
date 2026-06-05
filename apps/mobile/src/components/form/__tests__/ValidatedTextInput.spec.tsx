import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ValidatedTextInput } from '../ValidatedTextInput';

describe('ValidatedTextInput', () => {
  it('should render label and TextInput', () => {
    render(
      <ValidatedTextInput
        label="手机号"
        value=""
        onChangeText={jest.fn()}
        placeholder="请输入手机号"
        accessibilityLabel="手机号输入框"
      />,
    );

    expect(screen.getByText('手机号')).toBeTruthy();
    expect(screen.getByLabelText('手机号输入框')).toBeTruthy();
  });

  it('should call onChangeText when user types', () => {
    const onChangeText = jest.fn();
    render(
      <ValidatedTextInput
        label="手机号"
        value=""
        onChangeText={onChangeText}
        accessibilityLabel="手机号输入框"
      />,
    );

    const input = screen.getByLabelText('手机号输入框');
    fireEvent.changeText(input, '13800138000');

    expect(onChangeText).toHaveBeenCalledWith('13800138000');
  });

  it('should display error message when error prop is provided', () => {
    render(
      <ValidatedTextInput
        label="手机号"
        value=""
        onChangeText={jest.fn()}
        error="手机号格式不正确"
        accessibilityLabel="手机号输入框"
      />,
    );

    expect(screen.getByText('手机号格式不正确')).toBeTruthy();
  });

  it('should have correct accessibilityLabel', () => {
    render(
      <ValidatedTextInput
        label="密码"
        value=""
        onChangeText={jest.fn()}
        accessibilityLabel="密码输入框"
      />,
    );

    expect(screen.getByLabelText('密码输入框')).toBeTruthy();
  });

  it('should toggle password visibility when secureTextEntry is true', () => {
    render(
      <ValidatedTextInput
        label="密码"
        value="secret123"
        onChangeText={jest.fn()}
        secureTextEntry
        accessibilityLabel="密码输入框"
      />,
    );

    const input = screen.getByLabelText('密码输入框');
    expect(input.props.secureTextEntry).toBe(true);

    const toggleButton = screen.getByLabelText('显示密码');
    fireEvent.press(toggleButton);

    expect(input.props.secureTextEntry).toBe(false);
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <ValidatedTextInput
        label="昵称"
        value="test"
        onChangeText={jest.fn()}
        disabled
        accessibilityLabel="昵称输入框"
      />,
    );

    const input = screen.getByLabelText('昵称输入框');
    expect(input.props.editable).toBe(false);
  });
});
