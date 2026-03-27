import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { CreateStoreDto, ListStoresQueryDto } from './dto';

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

  async create(dto: CreateStoreDto) {
    if (dto.googlePlaceId) {
      const existing = await this.prisma.store.findUnique({
        where: { googlePlaceId: dto.googlePlaceId },
      });
      if (existing) return existing;
    }

    const byNameAndAddress = await this.prisma.store.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        address: { equals: dto.address, mode: 'insensitive' },
        city: { equals: dto.city, mode: 'insensitive' },
      },
    });
    if (byNameAndAddress) return byNameAndAddress;

    return this.prisma.store.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state.toUpperCase(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        googlePlaceId: dto.googlePlaceId,
      },
    });
  }
}
