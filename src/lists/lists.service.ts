import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CreateListDto, UpdateListDto } from './dto';

@Injectable()
export class ListsService {
  constructor(private prisma: PrismaService) {}

  async findUserLists(userId: string) {
    const owned = await this.prisma.shoppingList.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true, members: true } } },
    });

    const memberOf = await this.prisma.shoppingList.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true, members: true } } },
    });

    const memberIds = new Set(memberOf.map((l) => l.id));
    return [...owned.filter((l) => !memberIds.has(l.id)), ...memberOf];
  }

  async findById(id: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id },
      include: {
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!list) {
      throw new NotFoundException('Shopping list not found');
    }

    return list;
  }

  async create(dto: CreateListDto, userId: string) {
    return this.prisma.shoppingList.create({
      data: { name: dto.name, ownerId: userId },
    });
  }

  async update(id: string, dto: UpdateListDto, userId: string) {
    await this.verifyWriteAccess(id, userId);
    return this.prisma.shoppingList.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('Shopping list not found');
    if (list.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete a list');
    }
    await this.prisma.shoppingList.delete({ where: { id } });
  }

  async optimize(id: string) {
    const items = await this.prisma.listItem.findMany({
      where: { listId: id },
      select: { productId: true, quantity: true },
    });

    if (items.length === 0) {
      return { listId: id, itemCount: 0, stores: [], bestStore: null };
    }

    const productIds = items.map((i) => i.productId);

    const stores = await this.prisma.store.findMany();

    const storeResults = await Promise.all(
      stores.map(async (store) => {
        const latestPrices: { product_id: string; price: number }[] =
          await this.prisma.$queryRawUnsafe(
            `SELECT DISTINCT ON (product_id) product_id, price
             FROM prices
             WHERE store_id = $1 AND product_id = ANY($2) AND is_valid = true
             ORDER BY product_id, submitted_at DESC`,
            store.id,
            productIds,
          );

        const priceMap = new Map(
          latestPrices.map((p) => [p.product_id, Number(p.price)]),
        );

        let totalCost = 0;
        let itemsAvailable = 0;
        let itemsMissing = 0;

        for (const item of items) {
          const price = priceMap.get(item.productId);
          if (price !== undefined) {
            totalCost += price * item.quantity;
            itemsAvailable++;
          } else {
            itemsMissing++;
          }
        }

        return {
          storeId: store.id,
          storeName: store.name,
          totalCost: Math.round(totalCost * 100) / 100,
          itemsAvailable,
          itemsMissing,
        };
      }),
    );

    const ranked = storeResults
      .filter((s) => s.itemsAvailable > 0)
      .sort((a, b) => a.totalCost - b.totalCost);

    const bestStore = ranked[0]
      ? {
          storeId: ranked[0].storeId,
          storeName: ranked[0].storeName,
          totalCost: ranked[0].totalCost,
          savings: ranked.length > 1
            ? Math.round((ranked[ranked.length - 1].totalCost - ranked[0].totalCost) * 100) / 100
            : 0,
        }
      : null;

    return {
      listId: id,
      itemCount: items.length,
      stores: ranked.map((s) => ({
        ...s,
        savings: bestStore
          ? Math.round((s.totalCost - bestStore.totalCost) * 100) / 100
          : 0,
      })),
      bestStore,
    };
  }

  private async verifyWriteAccess(listId: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
      include: { members: { where: { userId } } },
    });
    if (!list) throw new NotFoundException('Shopping list not found');
    if (list.ownerId === userId) return;
    if (list.members[0]?.role === 'editor') return;
    throw new ForbiddenException('No write access to this list');
  }
}
