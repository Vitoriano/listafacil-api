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
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.subCategoryId) {
      where.subCategoryId = query.subCategoryId;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          subCategory: { select: { id: true, name: true } },
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
      }),
      this.prisma.product.count({ where }),
    ]);

    const products = data.map(({ prices, ...product }) => ({
      ...product,
      latestPrice: prices[0] ?? null,
    }));

    return new PaginatedResponse(products, total, query.page, query.limit);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
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
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const { prices, ...rest } = product;
    return { ...rest, latestPrice: prices[0] ?? null };
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
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
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const { prices, ...rest } = product;
    return { ...rest, latestPrice: prices[0] ?? null };
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: dto,
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
  }
}
