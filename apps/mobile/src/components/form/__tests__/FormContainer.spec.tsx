import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FormContainer } from '../FormContainer';

describe('FormContainer', () => {
  it('should render children elements', () => {
    render(
      <FormContainer onSubmit={jest.fn()} submitLabel="提交">
        <Text testID="child-element">表单内容</Text>
      </FormContainer>,
    );

    expect(screen.getByTestId('child-element')).toBeTruthy();
  });

  it('should call onSubmit when submit button is pressed', () => {
    const onSubmit = jest.fn();
    render(
      <FormContainer onSubmit={onSubmit} submitLabel="登录">
        <Text>内容</Text>
      </FormContainer>,
    );

    const submitButton = screen.getByLabelText('登录');
    fireEvent.press(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should disable submit button and show loading when isLoading is true', () => {
    const onSubmit = jest.fn();
    render(
      <FormContainer onSubmit={onSubmit} submitLabel="登录" isLoading>
        <Text>内容</Text>
      </FormContainer>,
    );

    const submitButton = screen.getByLabelText('登录');
    expect(submitButton.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should render as ScrollView for scrollable content', () => {
    render(
      <FormContainer onSubmit={jest.fn()} submitLabel="提交">
        <Text testID="scroll-content">可滚动内容</Text>
      </FormContainer>,
    );

    expect(screen.getByTestId('scroll-content')).toBeTruthy();
  });
});
