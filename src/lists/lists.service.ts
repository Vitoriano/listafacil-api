import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { CreateListDto, UpdateListDto } from './dto';

@Injectable()
export class ListsService {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
  ) {}

  async findUserLists(userId: string) {
    const includeOpts = {
      _count: { select: { items: true, members: true } },
      items: { select: { estimatedPrice: true, quantity: true } },
    };

    const owned = await this.prisma.shoppingList.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: includeOpts,
    });

    const memberOf = await this.prisma.shoppingList.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: includeOpts,
    });

    const memberIds = new Set(memberOf.map((l) => l.id));
    const lists = [...owned.filter((l) => !memberIds.has(l.id)), ...memberOf];

    return lists.map(({ items, ...list }) => ({
      ...list,
      estimatedTotal: items.reduce(
        (sum, item) => sum + Number(item.estimatedPrice) * item.quantity,
        0,
      ),
    }));
  }

  async findById(id: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                prices: {
                  orderBy: { submittedAt: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    price: true,
                    storeId: true,
                    submittedAt: true,
                    store: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!list) {
      throw new NotFoundException('Shopping list not found');
    }

    return {
      ...list,
      items: list.items.map(({ product, ...item }) => {
        const { prices, ...productData } = product;
        return {
          ...item,
          product: { ...productData, latestPrice: prices[0] ?? null },
        };
      }),
    };
  }

  async create(dto: CreateListDto, userId: string) {
    return this.prisma.shoppingList.create({
      data: { name: dto.name, ownerId: userId },
    });
  }

  async update(id: string, dto: UpdateListDto, userId: string) {
    await this.verifyWriteAccess(id, userId);
    const list = await this.prisma.shoppingList.update({
      where: { id },
      data: dto,
    });

    this.ws.emitToList(id, 'list:updated', list);
    return list;
  }

  async delete(id: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('Shopping list not found');
    if (list.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete a list');
    }
    await this.prisma.shoppingList.delete({ where: { id } });

    this.ws.emitToList(id, 'list:deleted', { listId: id });
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
