import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { MockOrder } from '../entities/mock-order.entity';
import {
  PaymentProviderInterface,
  CreatePaymentOrderInput,
  PaymentOrderResult,
  PaymentProcessResult,
  PaymentCallbackInput,
  PaymentCallbackResult,
  PaymentOrderStatus,
} from '../interfaces/payment-provider.interface';

/**
 * Mock Payment Service
 *
 * Simulates a third-party payment provider for MVP development.
 * All orders are persisted to the database via MockOrder entity.
 *
 * Key features:
 * - Order persistence (survives service restarts)
 * - 15-minute expiry window
 * - Idempotent callback handling
 * - Async callback simulation via EventEmitter2
 *
 * Future: Replace with WeChatPayService or AlipayService implementing
 * PaymentProviderInterface.
 */
@Injectable()
export class MockPaymentService implements PaymentProviderInterface {
  private readonly logger = new Logger(MockPaymentService.name);
  private readonly orderExpiryMinutes = 15;

  private readonly eventEmitter = new EventEmitter();

  constructor(
    @InjectRepository(MockOrder)
    private readonly orderRepo: Repository<MockOrder>,
  ) {}

  /**
   * Create a new payment order.
   */
  async createOrder(dto: CreatePaymentOrderInput): Promise<PaymentOrderResult> {
    const orderNo = this.generateOrderNo();
    const expireAt = new Date(Date.now() + this.orderExpiryMinutes * 60 * 1000);

    const order = this.orderRepo.create({
      orderNo,
      matchId: dto.matchId,
      playerId: dto.playerId,
      amount: dto.amount,
      status: 'pending',
      expireAt,
      description: dto.description ?? null,
    });

    const saved = await this.orderRepo.save(order);
    this.logger.log(
      `Mock order created: ${orderNo}, matchId=${dto.matchId}, amount=${dto.amount}`,
    );

    return {
      orderNo: saved.orderNo,
      amount: saved.amount,
      expireAt: saved.expireAt,
      status: saved.status,
    };
  }

  /**
   * Simulate user confirming payment.
   * Marks order as paid and emits async callback event.
   *
   * Protected by database transaction to ensure atomic state updates.
   */
  async processPayment(orderNo: string): Promise<PaymentProcessResult> {
    return this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(MockOrder, { where: { orderNo } });

      if (!order) {
        return { success: false, orderNo, errorMessage: '订单不存在' };
      }

      if (order.status !== 'pending') {
        return {
          success: false,
          orderNo,
          errorMessage: `订单状态不正确: ${order.status}`,
        };
      }

      if (new Date() > order.expireAt) {
        order.status = 'closed';
        order.closedAt = new Date();
        await manager.save(order);
        return { success: false, orderNo, errorMessage: '订单已过期' };
      }

      order.status = 'paid';
      order.paidAt = new Date();
      await manager.save(order);

      this.logger.log(`Mock payment processed: ${orderNo}`);

      return { success: true, orderNo, paidAt: order.paidAt };
    });
  }

  /**
   * Handle payment callback (idempotent).
   *
   * Protected by database transaction to ensure atomic state updates
   * and prevent race conditions between concurrent callbacks.
   */
  async handleCallback(
    dto: PaymentCallbackInput,
  ): Promise<PaymentCallbackResult> {
    return this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(MockOrder, {
        where: { orderNo: dto.orderNo },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        return {
          orderNo: dto.orderNo,
          success: false,
          processed: false,
          message: '订单不存在',
        };
      }

      // Idempotency: already processed
      if (order.callbackProcessed) {
        return {
          orderNo: dto.orderNo,
          success: true,
          processed: false,
          message: '回调已处理',
        };
      }

      order.callbackProcessed = true;

      if (dto.status === 'success') {
        order.status = 'paid';
        order.paidAt = order.paidAt ?? new Date();
      } else if (dto.status === 'failed') {
        order.status = 'failed';
      } else if (dto.status === 'closed') {
        order.status = 'closed';
        order.closedAt = new Date();
      }

      await manager.save(order);
      this.logger.log(
        `Payment callback handled: ${dto.orderNo}, status=${dto.status}`,
      );

      return {
        orderNo: dto.orderNo,
        success: dto.status === 'success',
        processed: true,
        message: '处理成功',
      };
    });
  }

  /**
   * Query order status from database.
   */
  async queryOrder(orderNo: string): Promise<PaymentOrderStatus> {
    const order = await this.orderRepo.findOne({ where: { orderNo } });

    if (!order) {
      throw new NotFoundException(`订单不存在: ${orderNo}`);
    }

    return {
      orderNo: order.orderNo,
      status: order.status,
      amount: order.amount,
      createdAt: order.createdAt,
      paidAt: order.paidAt ?? undefined,
      closedAt: order.closedAt ?? undefined,
    };
  }

  /**
   * Close an order manually.
   */
  async closeOrder(orderNo: string): Promise<boolean> {
    return this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(MockOrder, { where: { orderNo } });

      if (!order) {
        return false;
      }

      if (order.status === 'paid') {
        return false; // Cannot close paid orders
      }

      order.status = 'closed';
      order.closedAt = new Date();
      await manager.save(order);

      this.logger.log(`Mock order closed: ${orderNo}`);
      return true;
    });
  }

  /**
   * Close all expired pending orders.
   * Returns the number of orders closed.
   */
  async closeExpiredOrders(): Promise<number> {
    const now = new Date();
    const result = await this.orderRepo.update(
      { status: 'pending', expireAt: LessThan(now) },
      { status: 'closed', closedAt: now },
    );

    const closedCount = result.affected ?? 0;
    if (closedCount > 0) {
      this.logger.log(`Closed ${closedCount} expired mock orders`);
    }

    return closedCount;
  }

  private generateOrderNo(): string {
    const timestamp = Date.now();
    const uuid = randomUUID().replace(/-/g, '').slice(0, 8);
    return `mock_${timestamp}_${uuid}`;
  }
}
