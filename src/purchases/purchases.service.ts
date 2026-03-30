import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../core/prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { PaginationQueryDto } from '../core/dto/pagination-query.dto';
import {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  AddPurchaseItemDto,
  UpdatePurchaseItemDto,
} from './dto';

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(userId: string, query: PaginationQueryDto) {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return new PaginatedResponse(data, total, query.page, query.limit);
  }

  async findRecent(userId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { userId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        store: { select: { id: true, name: true } },
        items: { select: { price: true, quantity: true } },
        _count: { select: { items: true } },
      },
    });

    return purchases.map(({ items, ...purchase }) => ({
      ...purchase,
      total: items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
    }));
  }

  async findById(id: string, userId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        store: true,
        items: { include: { product: true } },
      },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.userId !== userId) throw new ForbiddenException();
    return purchase;
  }

  async create(dto: CreatePurchaseDto, userId: string) {
    await this.prisma.store.findUniqueOrThrow({
      where: { id: dto.storeId },
    });

    const purchase = await this.prisma.purchase.create({
      data: {
        userId,
        storeId: dto.storeId,
        linkedListId: dto.linkedListId,
      },
      include: { store: { select: { id: true, name: true } } },
    });

    if (dto.linkedListId) {
      this.ws.emitToList(dto.linkedListId, 'purchase:started', {
        purchaseId: purchase.id,
        storeId: dto.storeId,
        userId,
      });
    }

    return purchase;
  }

  async updateStatus(id: string, dto: UpdatePurchaseDto, userId: string) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id } });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.userId !== userId) throw new ForbiddenException();

    if (purchase.status !== 'active') {
      throw new BadRequestException(
        `Cannot transition from ${purchase.status} to ${dto.status}`,
      );
    }

    const data: any = { status: dto.status };
    if (dto.status === 'completed') {
      data.completedAt = new Date();
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data,
      include: { store: { select: { id: true, name: true } } },
    });

    if (dto.status === 'completed') {
      await this.cacheManager.del(`user:${userId}:stats`);
    }

    this.ws.emitToPurchase(id, 'purchase:status:updated', updated);

    if (purchase.linkedListId) {
      this.ws.emitToList(purchase.linkedListId, 'purchase:status:updated', {
        purchaseId: id,
        status: dto.status,
      });
    }

    return updated;
  }

  async addItem(purchaseId: string, dto: AddPurchaseItemDto, userId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.userId !== userId) throw new ForbiddenException();
    if (purchase.status !== 'active') {
      throw new BadRequestException('Cannot add items to a non-active purchase');
    }

    const item = await this.prisma.purchaseItem.create({
      data: {
        purchaseId,
        productId: dto.productId,
        barcode: dto.barcode,
        price: dto.price,
        quantity: dto.quantity ?? 1,
        fromListId: dto.fromListId,
      },
      include: { product: true },
    });

    this.ws.emitToPurchase(purchaseId, 'purchase:item:added', item);

    if (purchase.linkedListId) {
      this.ws.emitToList(purchase.linkedListId, 'purchase:item:added', {
        purchaseId,
        item,
      });
    }

    return item;
  }

  async updateItem(
    purchaseId: string,
    itemId: string,
    dto: UpdatePurchaseItemDto,
    userId: string,
  ) {
    await this.verifyPurchaseOwnership(purchaseId, userId);

    const item = await this.prisma.purchaseItem.findFirst({
      where: { id: itemId, purchaseId },
    });
    if (!item) throw new NotFoundException('Purchase item not found');

    const updated = await this.prisma.purchaseItem.update({
      where: { id: itemId },
      data: dto,
      include: { product: true },
    });

    this.ws.emitToPurchase(purchaseId, 'purchase:item:updated', updated);
    return updated;
  }

  async removeItem(purchaseId: string, itemId: string, userId: string) {
    await this.verifyPurchaseOwnership(purchaseId, userId);

    const item = await this.prisma.purchaseItem.findFirst({
      where: { id: itemId, purchaseId },
    });
    if (!item) throw new NotFoundException('Purchase item not found');

    await this.prisma.purchaseItem.delete({ where: { id: itemId } });

    this.ws.emitToPurchase(purchaseId, 'purchase:item:removed', { purchaseId, itemId });
  }

  private async verifyPurchaseOwnership(purchaseId: string, userId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.userId !== userId) throw new ForbiddenException();
    if (purchase.status !== 'active') {
      throw new BadRequestException('Purchase is not active');
    }
  }
}
