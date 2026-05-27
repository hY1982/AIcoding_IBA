import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render admin dashboard', () => {
    render(<App />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});
