import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SystemParamsPage from './SystemParamsPage';
import { getSystemParams, updateSystemParam } from '@/api/admin';
import type { SystemParam } from '@shared/system';

jest.mock('@/api/admin', () => ({
  getSystemParams: jest.fn(),
  updateSystemParam: jest.fn(),
}));

describe('SystemParamsPage', () => {
  const mockGetSystemParams = getSystemParams as jest.MockedFunction<typeof getSystemParams>;
  const mockUpdateSystemParam = updateSystemParam as jest.MockedFunction<typeof updateSystemParam>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render system params table', async () => {
    const mockParams: SystemParam[] = [
      {
        id: 1,
        paramKey: 'base_ability_weights',
        paramValue: { height: 0.2, weight: 0.1 },
        description: '基础能力值权重',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    mockGetSystemParams.mockResolvedValue(mockParams);

    render(<SystemParamsPage />);

    await waitFor(() => {
      expect(screen.getByText('base_ability_weights')).toBeInTheDocument();
      expect(screen.getByText('基础能力值权重')).toBeInTheDocument();
    });
  });

  it('should call API to fetch params on mount', async () => {
    const mockParams: SystemParam[] = [
      {
        id: 1,
        paramKey: 'base_ability_weights',
        paramValue: { height: 0.2 },
        description: 'test',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    mockGetSystemParams.mockResolvedValue(mockParams);

    render(<SystemParamsPage />);

    await waitFor(() => {
      expect(mockGetSystemParams).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('should update param value through API', async () => {
    const mockParams: SystemParam[] = [
      {
        id: 1,
        paramKey: 'base_ability_weights',
        paramValue: { height: 0.2 },
        description: 'test',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    mockGetSystemParams.mockResolvedValue(mockParams);
    mockUpdateSystemParam.mockResolvedValue(mockParams[0]);

    render(<SystemParamsPage />);

    await waitFor(() => {
      expect(screen.getByText('编辑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('编辑'));

    await waitFor(() => {
      const textareas = screen.queryAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });

    expect(mockUpdateSystemParam).not.toHaveBeenCalled();
  });
});
