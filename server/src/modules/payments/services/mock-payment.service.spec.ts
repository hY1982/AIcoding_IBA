import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter } from 'events';
import { NotFoundException } from '@nestjs/common';
import { MockPaymentService } from './mock-payment.service';
import { MockOrder } from '../entities/mock-order.entity';
import { PaymentCallbackInput } from '../interfaces/payment-provider.interface';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => {
  const repo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  (repo as any).manager = {
    transaction: jest.fn(),
  };
  return repo as MockRepository<T>;
};

// ==================== Test Suite ====================

describe('MockPaymentService', () => {
  let service: MockPaymentService;
  let orderRepo: MockRepository<MockOrder>;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    orderRepo = createMockRepository();
    eventEmitter = new EventEmitter();

    // Default mock for manager.transaction: pass-through to repo methods
    (orderRepo as any).manager.transaction.mockImplementation(async (cb: any) => {
      const manager = {
        findOne: orderRepo.findOne,
        save: orderRepo.save,
      };
      return cb(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockPaymentService,
        {
          provide: getRepositoryToken(MockOrder),
          useValue: orderRepo,
        },
      ],
    }).compile();

    service = module.get<MockPaymentService>(MockPaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CREATE ORDER ====================

  describe('createOrder', () => {
    it('should create an order with pending status and 15min expiry', async () => {
      const dto = {
        matchId: 1,
        playerId: 2,
        amount: '50.00',
        description: 'Test payment',
      };

      const mockOrder = {
        id: 1,
        orderNo: 'mock_1234567890_0001',
        matchId: 1,
        playerId: 2,
        amount: '50.00',
        status: 'pending',
        expireAt: new Date(Date.now() + 15 * 60 * 1000),
        description: 'Test payment',
        createdAt: new Date(),
      } as MockOrder;

      orderRepo.create!.mockReturnValue(mockOrder);
      orderRepo.save!.mockResolvedValue(mockOrder);

      const result = await service.createOrder(dto);

      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: 1,
          playerId: 2,
          amount: '50.00',
          status: 'pending',
          description: 'Test payment',
        }),
      );
      expect(result.orderNo).toMatch(/^mock_\d+_\d{4}$/);
      expect(result.status).toBe('pending');
      expect(result.amount).toBe('50.00');
      expect(result.expireAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create an order without description', async () => {
      const dto = {
        matchId: 1,
        playerId: 2,
        amount: '30.00',
      };

      const mockOrder = {
        id: 1,
        orderNo: 'mock_1234567890_0002',
        matchId: 1,
        playerId: 2,
        amount: '30.00',
        status: 'pending',
        expireAt: new Date(Date.now() + 15 * 60 * 1000),
        description: null,
        createdAt: new Date(),
      } as MockOrder;

      orderRepo.create!.mockReturnValue(mockOrder);
      orderRepo.save!.mockResolvedValue(mockOrder);

      const result = await service.createOrder(dto);

      expect(result.status).toBe('pending');
      expect(result.amount).toBe('30.00');
    });
  });

  // ==================== PROCESS PAYMENT ====================

  describe('processPayment', () => {
    it('should process payment successfully for pending order', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'pending',
        expireAt: new Date(Date.now() + 10 * 60 * 1000),
        paidAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const result = await service.processPayment(orderNo);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe(orderNo);
      expect(result.paidAt).toBeDefined();
    });

    it('should fail when order does not exist', async () => {
      orderRepo.findOne!.mockResolvedValue(null);

      const result = await service.processPayment('non_existent');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('订单不存在');
    });

    it('should fail when order status is not pending', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'paid',
        expireAt: new Date(Date.now() + 10 * 60 * 1000),
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);

      const result = await service.processPayment(orderNo);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('订单状态不正确');
    });

    it('should fail and close order when expired', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'pending',
        expireAt: new Date(Date.now() - 1000), // expired
        closedAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const result = await service.processPayment(orderNo);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('订单已过期');
      expect(mockOrder.status).toBe('closed');
    });
  });

  // ==================== HANDLE CALLBACK ====================

  describe('handleCallback', () => {
    it('should process callback successfully for pending order', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'pending',
        callbackProcessed: false,
        paidAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const dto: PaymentCallbackInput = {
        orderNo,
        status: 'success',
        transactionId: 'tx_123',
      };

      const result = await service.handleCallback(dto);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.message).toBe('处理成功');
      expect(mockOrder.callbackProcessed).toBe(true);
      expect(mockOrder.status).toBe('paid');
    });

    it('should return processed=false for duplicate callback (idempotency)', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'paid',
        callbackProcessed: true,
        paidAt: new Date(),
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const dto: PaymentCallbackInput = {
        orderNo,
        status: 'success',
      };

      const result = await service.handleCallback(dto);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(false);
      expect(result.message).toBe('回调已处理');
    });

    it('should handle failed callback', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'pending',
        callbackProcessed: false,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const dto: PaymentCallbackInput = {
        orderNo,
        status: 'failed',
        errorMessage: 'Insufficient balance',
      };

      const result = await service.handleCallback(dto);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(true);
      expect(mockOrder.status).toBe('failed');
    });

    it('should handle closed callback', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        id: 1,
        orderNo,
        status: 'pending',
        callbackProcessed: false,
        closedAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const dto: PaymentCallbackInput = {
        orderNo,
        status: 'closed',
      };

      const result = await service.handleCallback(dto);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(true);
      expect(mockOrder.status).toBe('closed');
      expect(mockOrder.closedAt).toBeDefined();
    });

    it('should fail when order does not exist', async () => {
      orderRepo.findOne!.mockResolvedValue(null);

      const dto: PaymentCallbackInput = {
        orderNo: 'non_existent',
        status: 'success',
      };

      const result = await service.handleCallback(dto);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(false);
      expect(result.message).toBe('订单不存在');
    });
  });

  // ==================== QUERY ORDER ====================

  describe('queryOrder', () => {
    it('should return order status for existing order', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        orderNo,
        status: 'paid',
        amount: '50.00',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        paidAt: new Date('2026-01-01T00:05:00Z'),
        closedAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);

      const result = await service.queryOrder(orderNo);

      expect(result.orderNo).toBe(orderNo);
      expect(result.status).toBe('paid');
      expect(result.amount).toBe('50.00');
      expect(result.paidAt).toBeDefined();
    });

    it('should throw NotFoundException for non-existent order', async () => {
      orderRepo.findOne!.mockResolvedValue(null);

      await expect(service.queryOrder('non_existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== CLOSE ORDER ====================

  describe('closeOrder', () => {
    it('should close a pending order', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        orderNo,
        status: 'pending',
        closedAt: null,
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);
      orderRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const result = await service.closeOrder(orderNo);

      expect(result).toBe(true);
      expect(mockOrder.status).toBe('closed');
      expect(mockOrder.closedAt).toBeDefined();
    });

    it('should not close a paid order', async () => {
      const orderNo = 'mock_1234567890_0001';
      const mockOrder = {
        orderNo,
        status: 'paid',
      } as MockOrder;

      orderRepo.findOne!.mockResolvedValue(mockOrder);

      const result = await service.closeOrder(orderNo);

      expect(result).toBe(false);
    });

    it('should return false for non-existent order', async () => {
      orderRepo.findOne!.mockResolvedValue(null);

      const result = await service.closeOrder('non_existent');

      expect(result).toBe(false);
    });
  });

  // ==================== CLOSE EXPIRED ORDERS ====================

  describe('closeExpiredOrders', () => {
    it('should close expired pending orders', async () => {
      orderRepo.update!.mockResolvedValue({ affected: 3, raw: [], generatedMaps: [] });

      const result = await service.closeExpiredOrders();

      expect(result).toBe(3);
      expect(orderRepo.update).toHaveBeenCalledWith(
        { status: 'pending', expireAt: LessThan(expect.any(Date)) },
        { status: 'closed', closedAt: expect.any(Date) },
      );
    });

    it('should return 0 when no expired orders', async () => {
      orderRepo.update!.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      const result = await service.closeExpiredOrders();

      expect(result).toBe(0);
    });
  });
});
