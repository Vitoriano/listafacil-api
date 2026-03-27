import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../core/prisma/prisma.service';
import { UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        joinedAt: true,
        _count: {
          select: {
            prices: true,
            shoppingLists: true,
            purchases: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        joinedAt: true,
      },
    });
  }

  async getSavings(userId: string) {
    const cacheKey = `user:${userId}:stats`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [totalPurchases, totalPricesSubmitted, completedPurchases] =
      await Promise.all([
        this.prisma.purchase.count({
          where: { userId, status: 'completed' },
        }),
        this.prisma.price.count({ where: { userId } }),
        this.prisma.purchase.findMany({
          where: { userId, status: 'completed' },
          include: { items: true },
        }),
      ]);

    const totalSpent = completedPurchases.reduce(
      (sum, p) =>
        sum +
        p.items.reduce(
          (itemSum, item) => itemSum + Number(item.price) * item.quantity,
          0,
        ),
      0,
    );

    const result = {
      totalPurchases,
      totalPricesSubmitted,
      totalSpent: Math.round(totalSpent * 100) / 100,
    };

    await this.cacheManager.set(cacheKey, result, 900_000);
    return result;
  }
}
