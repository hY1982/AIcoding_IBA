import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLayout from './AdminLayout';

describe('AdminLayout', () => {
  it('should render layout structure', () => {
    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(document.querySelector('.ant-layout')).toBeInTheDocument();
  });
});
