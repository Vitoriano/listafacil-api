import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { ListStoresQueryDto } from './dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: ListStoresQueryDto) {
    const where: Prisma.StoreWhereInput = {};

    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = query.state.toUpperCase();
    }
    if (query.type) {
      where.type = query.type;
    }

    const [data, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    return new PaginatedResponse(data, total, query.page, query.limit);
  }

  async findById(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}
