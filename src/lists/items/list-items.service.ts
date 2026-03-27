import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AddListItemDto, UpdateListItemDto } from '../dto';

@Injectable()
export class ListItemsService {
  constructor(private prisma: PrismaService) {}

  async addItem(listId: string, dto: AddListItemDto) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });

    return this.prisma.listItem.create({
      data: {
        listId,
        productId: dto.productId,
        quantity: dto.quantity ?? 1,
        estimatedPrice: dto.estimatedPrice ?? 0,
      },
      include: { product: true },
    });
  }

  async updateItem(listId: string, itemId: string, dto: UpdateListItemDto) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, listId },
    });
    if (!item) throw new NotFoundException('List item not found');

    return this.prisma.listItem.update({
      where: { id: itemId },
      data: dto,
      include: { product: true },
    });
  }

  async removeItem(listId: string, itemId: string) {
    const item = await this.prisma.listItem.findFirst({
      where: { id: itemId, listId },
    });
    if (!item) throw new NotFoundException('List item not found');

    await this.prisma.listItem.delete({ where: { id: itemId } });
  }
}
