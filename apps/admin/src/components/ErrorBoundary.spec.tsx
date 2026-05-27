import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const ThrowError = () => {
  throw new Error('test error');
};

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('normal content')).toBeInTheDocument();
  });

  it('should render fallback when child throws', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('应用出错')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
