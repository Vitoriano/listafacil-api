import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { PaginationQueryDto } from '../core/dto/pagination-query.dto';
import { PricesService } from './prices.service';
import { SubmitPriceDto, ValidatePriceDto, PriceHistoryQueryDto } from './dto';

@ApiTags('Prices')
@ApiBearerAuth()
@Controller()
export class PricesController {
  constructor(private pricesService: PricesService) {}

  @Post('products/:productId/prices')
  @ApiOperation({ summary: 'Submit a price for a product at a store' })
  @ApiParam({ name: 'productId', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'Price submitted successfully',
    schema: {
      example: {
        id: 'uuid',
        productId: 'uuid',
        storeId: 'uuid',
        userId: 'uuid',
        price: '25.90',
        submittedAt: '2026-03-30T00:00:00.000Z',
        isValid: true,
        store: { id: 'uuid', name: 'Supermercado X' },
      },
    },
  })
  submitPrice(
    @Param('productId') productId: string,
    @Body() dto: SubmitPriceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pricesService.submitPrice(productId, dto, userId);
  }

  @Get('products/:productId/prices')
  @ApiOperation({ summary: 'List all prices for a product (paginated)' })
  @ApiParam({ name: 'productId', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of prices with store and user info',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            productId: 'uuid',
            storeId: 'uuid',
            userId: 'uuid',
            price: '25.90',
            submittedAt: '2026-03-30T00:00:00.000Z',
            isValid: true,
            store: { id: 'uuid', name: 'Supermercado X' },
            user: { id: 'uuid', name: 'João Silva' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  getProductPrices(
    @Param('productId') productId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.pricesService.getProductPrices(productId, query);
  }

  @Get('products/:productId/prices/comparison')
  @ApiOperation({ summary: 'Compare latest valid price across stores' })
  @ApiParam({ name: 'productId', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Array of latest price per store, sorted by price ascending',
    schema: {
      example: [
        {
          storeId: 'uuid',
          storeName: 'Supermercado X',
          city: 'São Paulo',
          state: 'SP',
          price: 25.9,
          submittedAt: '2026-03-30T00:00:00.000Z',
        },
        {
          storeId: 'uuid',
          storeName: 'Supermercado Y',
          city: 'São Paulo',
          state: 'SP',
          price: 28.5,
          submittedAt: '2026-03-29T00:00:00.000Z',
        },
      ],
    },
  })
  getComparison(@Param('productId') productId: string) {
    return this.pricesService.getComparison(productId);
  }

  @Get('products/:productId/prices/history')
  @ApiOperation({ summary: 'Get price history for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Array of historical prices sorted chronologically (ascending)',
    schema: {
      example: [
        {
          price: 24.5,
          submittedAt: '2026-03-25T00:00:00.000Z',
          storeId: 'uuid',
          storeName: 'Supermercado X',
        },
        {
          price: 25.9,
          submittedAt: '2026-03-30T00:00:00.000Z',
          storeId: 'uuid',
          storeName: 'Supermercado X',
        },
      ],
    },
  })
  getPriceHistory(
    @Param('productId') productId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.pricesService.getPriceHistory(productId, query);
  }

  @Post('prices/:priceId/validate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Vote on price validity (cannot vote on own price)' })
  @ApiParam({ name: 'priceId', description: 'Price ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Vote registered successfully (no content)' })
  @ApiResponse({ status: 403, description: 'Cannot validate your own price' })
  @ApiResponse({ status: 404, description: 'Price not found' })
  @ApiResponse({ status: 409, description: 'Already voted on this price' })
  validatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: ValidatePriceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pricesService.validatePrice(priceId, dto, userId);
  }
}
