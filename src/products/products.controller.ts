import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, SearchProductsQueryDto } from './dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Search products with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of products with latest price',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            name: 'Arroz Tio João 5kg',
            brand: 'Tio João',
            barcode: '7891234567890',
            categoryId: 1,
            subCategoryId: 2,
            unit: 'kg',
            imageUrl: 'https://... | null',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
            category: { id: 1, name: 'Alimentos' },
            subCategory: { id: 2, name: 'Grãos' },
            latestPrice: {
              id: 'uuid',
              price: '25.90',
              storeId: 'uuid',
              submittedAt: '2026-03-30T00:00:00.000Z',
              store: { id: 'uuid', name: 'Supermercado X' },
            },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  search(@Query() query: SearchProductsQueryDto) {
    return this.productsService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Product with category, subcategory and latest price',
    schema: {
      example: {
        id: 'uuid',
        name: 'Arroz Tio João 5kg',
        brand: 'Tio João',
        barcode: '7891234567890',
        categoryId: 1,
        subCategoryId: 2,
        unit: 'kg',
        imageUrl: null,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
        category: { id: 1, name: 'Alimentos' },
        subCategory: { id: 2, name: 'Grãos' },
        latestPrice: {
          id: 'uuid',
          price: '25.90',
          storeId: 'uuid',
          submittedAt: '2026-03-30T00:00:00.000Z',
          store: { id: 'uuid', name: 'Supermercado X' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Get product by barcode' })
  @ApiParam({ name: 'barcode', description: 'Product barcode (8-14 chars)' })
  @ApiResponse({
    status: 200,
    description: 'Product with category, subcategory and latest price',
    schema: {
      example: {
        id: 'uuid',
        name: 'Arroz Tio João 5kg',
        brand: 'Tio João',
        barcode: '7891234567890',
        categoryId: 1,
        subCategoryId: 2,
        unit: 'kg',
        imageUrl: null,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
        category: { id: 1, name: 'Alimentos' },
        subCategory: { id: 2, name: 'Grãos' },
        latestPrice: {
          id: 'uuid',
          price: '25.90',
          storeId: 'uuid',
          submittedAt: '2026-03-30T00:00:00.000Z',
          store: { id: 'uuid', name: 'Supermercado X' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    schema: {
      example: {
        id: 'uuid',
        name: 'Arroz Tio João 5kg',
        brand: 'Tio João',
        barcode: '7891234567890',
        categoryId: 1,
        subCategoryId: 2,
        unit: 'kg',
        imageUrl: null,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
        category: { id: 1, name: 'Alimentos' },
        subCategory: { id: 2, name: 'Grãos' },
      },
    },
  })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }
}
