import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { CreateProductDto, SearchProductsQueryDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async search(query: SearchProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {};

    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }
    if (query.category) {
      where.category = query.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return new PaginatedResponse(data, total, query.page, query.limit);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }
}
