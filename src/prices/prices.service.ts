import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../core/prisma/prisma.service';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { PaginationQueryDto } from '../core/dto/pagination-query.dto';
import { SubmitPriceDto, ValidatePriceDto, PriceHistoryQueryDto } from './dto';

@Injectable()
export class PricesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async submitPrice(productId: string, dto: SubmitPriceDto, userId: string) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    await this.prisma.store.findUniqueOrThrow({
      where: { id: dto.storeId },
    });

    const price = await this.prisma.price.create({
      data: {
        productId,
        storeId: dto.storeId,
        userId,
        price: dto.price,
      },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    await this.cacheManager.del(`prices:comparison:${productId}`);

    return price;
  }

  async getProductPrices(productId: string, query: PaginationQueryDto) {
    const where = { productId };

    const [data, total] = await Promise.all([
      this.prisma.price.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          store: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.price.count({ where }),
    ]);

    return new PaginatedResponse(data, total, query.page, query.limit);
  }

  async getComparison(productId: string) {
    const cacheKey = `prices:comparison:${productId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const prices = await this.prisma.price.findMany({
      where: { productId, isValid: true },
      orderBy: { submittedAt: 'desc' },
      distinct: ['storeId'],
      include: {
        store: { select: { id: true, name: true, city: true, state: true } },
      },
    });

    const result = prices
      .map((p) => ({
        storeId: p.storeId,
        storeName: p.store.name,
        city: p.store.city,
        state: p.store.state,
        price: Number(p.price),
        submittedAt: p.submittedAt,
      }))
      .sort((a, b) => a.price - b.price);

    await this.cacheManager.set(cacheKey, result, 300_000);
    return result;
  }

  async getPriceHistory(productId: string, query: PriceHistoryQueryDto) {
    const where: any = { productId, isValid: true };
    if (query.storeId) {
      where.storeId = query.storeId;
    }

    const prices = await this.prisma.price.findMany({
      where,
      orderBy: { submittedAt: 'asc' },
      select: {
        price: true,
        submittedAt: true,
        store: { select: { id: true, name: true } },
      },
    });

    return prices.map((p) => ({
      price: Number(p.price),
      submittedAt: p.submittedAt,
      storeId: p.store.id,
      storeName: p.store.name,
    }));
  }

  async validatePrice(priceId: string, dto: ValidatePriceDto, userId: string) {
    const price = await this.prisma.price.findUnique({
      where: { id: priceId },
    });
    if (!price) {
      throw new NotFoundException('Price not found');
    }

    if (price.userId === userId) {
      throw new ForbiddenException('Cannot validate your own price');
    }

    const existing = await this.prisma.priceValidation.findUnique({
      where: { priceId_userId: { priceId, userId } },
    });
    if (existing) {
      throw new ConflictException('Already voted on this price');
    }

    await this.prisma.priceValidation.create({
      data: { priceId, userId, isValid: dto.isValid },
    });
  }
}
