import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WsGateway } from '../../ws/ws.gateway';
import { AddListItemDto, UpdateListItemDto } from '../dto';

@Injectable()
export class ListItemsService {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
  ) {}

  async addItem(listId: string, dto: AddListItemDto) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });

    const item = await this.prisma.listItem.create({
      data: {
        listId,
        productId: dto.productId,
        quantity: dto.quantity ?? 1,
        estimatedPrice: dto.estimatedPrice ?? 0,
      },
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
    });

    const { product, ...rest } = item;
    const { prices, ...productData } = product;
    const result = { ...rest, product: { ...productData, latestPrice: prices[0] ?? null } };

    this.ws.emitToList(listId, 'list:item:added', result);
    return result;
  }

  async updateItem(listId: string, itemId: string, dto: UpdateListItemDto) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, listId },
    });
    if (!item) throw new NotFoundException('List item not found');

    const updated = await this.prisma.listItem.update({
      where: { id: itemId },
      data: dto,
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
    });

    const { product, ...rest } = updated;
    const { prices, ...productData } = product;
    const result = { ...rest, product: { ...productData, latestPrice: prices[0] ?? null } };

    this.ws.emitToList(listId, 'list:item:updated', result);
    return result;
  }

  async removeItem(listId: string, itemId: string) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, listId },
    });
    if (!item) throw new NotFoundException('List item not found');

    await this.prisma.listItem.delete({ where: { id: itemId } });

    this.ws.emitToList(listId, 'list:item:removed', { listId, itemId });
  }
}
