import { venueService, VenueServiceError } from '../venue.service';
import { apiClient } from '../client';
import type { VenueListItem, VenueDetail, VenueTimeSlot } from '@shared/venue';
import type { PaginatedResponse } from '@shared/common';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('VenueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockVenueDetail: VenueDetail = {
    id: 1,
    managerId: 1,
    name: '深圳湾体育中心篮球场',
    address: '南山区滨海大道3001号',
    pricePerHour: 120,
    courtCount: 4,
    floorMaterial: 'wood',
    courtType: 'indoor',
    lighting: 'LED专业照明',
    ventilation: true,
    airCondition: true,
    parking: true,
    restroom: true,
    shower: true,
    lockerRoom: true,
    status: 'active',
    ratingAvg: 4.8,
    ratingCount: 128,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };

  describe('getVenues', () => {
    const mockPaginatedResponse: PaginatedResponse<VenueListItem> = {
      page: 1,
      pageSize: 10,
      total: 2,
      list: [
        {
          id: 1,
          name: '深圳湾体育中心篮球场',
          address: '南山区滨海大道3001号',
          pricePerHour: 120,
          courtCount: 4,
          floorMaterial: 'wood',
          courtType: 'indoor',
          ventilation: true,
          airCondition: true,
          parking: true,
          status: 'active',
          ratingAvg: 4.8,
          ratingCount: 128,
        },
        {
          id: 2,
          name: '福田体育公园篮球场',
          address: '福田区福强路3030号',
          pricePerHour: 100,
          courtCount: 6,
          floorMaterial: 'pu',
          courtType: 'indoor',
          ventilation: true,
          status: 'active',
          ratingAvg: 4.5,
          ratingCount: 86,
        },
      ],
    };

    it('should fetch venues with pagination params', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedResponse },
      });

      const result = await venueService.getVenues({ page: 1, pageSize: 10 });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues', {
        params: { page: 1, pageSize: 10 },
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should fetch venues with regionCode filter', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedResponse },
      });

      await venueService.getVenues({ page: 1, pageSize: 10, regionCode: 'shenzhen_nanshan' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues', {
        params: { page: 1, pageSize: 10, regionCode: 'shenzhen_nanshan' },
      });
    });

    it('should throw VenueServiceError on API failure', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '服务器错误' } },
      });

      await expect(venueService.getVenues({ page: 1, pageSize: 10 })).rejects.toThrow(
        VenueServiceError,
      );
      await expect(venueService.getVenues({ page: 1, pageSize: 10 })).rejects.toThrow('服务器错误');
    });

    it('should throw generic error message when no response message', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('network error'));

      await expect(venueService.getVenues({ page: 1, pageSize: 10 })).rejects.toThrow(
        '网络错误，请稍后重试',
      );
    });
  });

  describe('getVenueTimeSlots', () => {
    const mockTimeSlots: VenueTimeSlot[] = [
      {
        id: 1,
        venueId: 1,
        slotDate: '2026-06-10',
        startTime: '09:00',
        endTime: '11:00',
        isBooked: false,
      },
      {
        id: 2,
        venueId: 1,
        slotDate: '2026-06-10',
        startTime: '11:00',
        endTime: '13:00',
        isBooked: true,
        matchId: 5,
      },
      {
        id: 3,
        venueId: 1,
        slotDate: '2026-06-10',
        startTime: '13:00',
        endTime: '15:00',
        isBooked: false,
      },
    ];

    it('should fetch time slots for a venue with specific date', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockTimeSlots },
      });

      const result = await venueService.getVenueTimeSlots(1, '2026-06-10');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues/1/slots', {
        params: { slotDate: '2026-06-10' },
      });
      expect(result).toEqual(mockTimeSlots);
    });

    it('should fetch time slots without date filter', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockTimeSlots },
      });

      const result = await venueService.getVenueTimeSlots(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues/1/slots', { params: {} });
      expect(result).toEqual(mockTimeSlots);
    });

    it('should throw VenueServiceError on API failure', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '场地不存在' } },
      });

      await expect(venueService.getVenueTimeSlots(999)).rejects.toThrow('场地不存在');
    });
  });

  describe('getVenueDetail', () => {
    it('should fetch venue detail by id', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockVenueDetail },
      });

      const result = await venueService.getVenueDetail(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues/1');
      expect(result).toEqual(mockVenueDetail);
    });

    it('should throw VenueServiceError on API failure', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '场地不存在' } },
      });

      await expect(venueService.getVenueDetail(999)).rejects.toThrow('场地不存在');
    });
  });

  describe('createVenue', () => {
    it('should create venue with valid data', async () => {
      const createDto = {
        name: '新场地',
        address: '测试地址',
        pricePerHour: 100,
        courtCount: 2,
      };
      mockedApiClient.post.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockVenueDetail },
      });

      const result = await venueService.createVenue(createDto);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/venues', createDto);
      expect(result).toEqual(mockVenueDetail);
    });

    it('should throw VenueServiceError on creation failure', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { message: '场地名称已存在' } },
      });

      await expect(
        venueService.createVenue({ name: '重复', address: '地址', pricePerHour: 100 }),
      ).rejects.toThrow('场地名称已存在');
    });
  });

  describe('getMyVenues', () => {
    it('should fetch my venues list', async () => {
      const mockMyVenues: VenueListItem[] = [
        {
          id: 1,
          name: '我的场地1',
          address: '地址1',
          pricePerHour: 100,
          courtCount: 2,
          status: 'active',
        },
      ];
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockMyVenues },
      });

      const result = await venueService.getMyVenues();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/venues/my');
      expect(result).toEqual(mockMyVenues);
    });

    it('should throw VenueServiceError on API failure', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('network error'));

      await expect(venueService.getMyVenues()).rejects.toThrow('网络错误，请稍后重试');
    });
  });

  describe('updateVenue', () => {
    it('should update venue with partial data', async () => {
      const updateDto = { name: '更新后的名称', pricePerHour: 150 };
      mockedApiClient.put.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockVenueDetail },
      });

      const result = await venueService.updateVenue(1, updateDto);

      expect(mockedApiClient.put).toHaveBeenCalledWith('/venues/1', updateDto);
      expect(result).toEqual(mockVenueDetail);
    });

    it('should throw VenueServiceError on update failure', async () => {
      mockedApiClient.put.mockRejectedValue({
        response: { data: { message: '无权修改此场地' } },
      });

      await expect(venueService.updateVenue(1, { name: '新名称' })).rejects.toThrow(
        '无权修改此场地',
      );
    });
  });

  describe('deleteVenue', () => {
    it('should delete venue by id', async () => {
      mockedApiClient.delete.mockResolvedValue({
        data: { code: 200, message: 'success', data: undefined },
      });

      await venueService.deleteVenue(1);

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/venues/1');
    });

    it('should throw VenueServiceError on delete failure', async () => {
      mockedApiClient.delete.mockRejectedValue({
        response: { data: { message: '场地不存在或无权删除' } },
      });

      await expect(venueService.deleteVenue(999)).rejects.toThrow('场地不存在或无权删除');
    });
  });
});
