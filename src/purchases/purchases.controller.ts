import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  AddPurchaseItemDto,
  UpdatePurchaseItemDto,
} from './dto';

@ApiTags('Purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'List all purchases of the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of purchases',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            userId: 'uuid',
            storeId: 'uuid',
            linkedListId: 'uuid | null',
            status: 'active | completed | cancelled',
            createdAt: '2026-03-30T00:00:00.000Z',
            completedAt: '2026-03-30T00:00:00.000Z | null',
            store: { id: 'uuid', name: 'Supermercado X' },
            _count: { items: 5 },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.purchasesService.findAll(userId, query);
  }

  @Get('recent')
  @ApiOperation({ summary: 'List 10 most recent completed purchases' })
  @ApiResponse({
    status: 200,
    description: 'Array of the 10 most recent completed purchases',
    schema: {
      example: [
        {
          id: 'uuid',
          userId: 'uuid',
          storeId: 'uuid',
          linkedListId: 'uuid | null',
          status: 'completed',
          createdAt: '2026-03-30T00:00:00.000Z',
          completedAt: '2026-03-30T00:00:00.000Z',
          store: { id: 'uuid', name: 'Supermercado X' },
          _count: { items: 5 },
          total: 127.45,
        },
      ],
    },
  })
  findRecent(@CurrentUser('id') userId: string) {
    return this.purchasesService.findRecent(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new purchase' })
  @ApiResponse({
    status: 201,
    description: 'Purchase created successfully',
    schema: {
      example: {
        id: 'uuid',
        userId: 'uuid',
        storeId: 'uuid',
        linkedListId: 'uuid | null',
        status: 'active',
        createdAt: '2026-03-30T00:00:00.000Z',
        completedAt: null,
        store: { id: 'uuid', name: 'Supermercado X' },
      },
    },
  })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser('id') userId: string) {
    return this.purchasesService.create(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase details with all items' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({
    status: 200,
    description:
      'Purchase with store details and all items (including product data)',
    schema: {
      example: {
        id: 'uuid',
        userId: 'uuid',
        storeId: 'uuid',
        linkedListId: 'uuid | null',
        status: 'active',
        createdAt: '2026-03-30T00:00:00.000Z',
        completedAt: null,
        store: {
          id: 'uuid',
          name: 'Supermercado X',
          address: 'Rua ...',
          city: 'São Paulo',
          state: 'SP',
          latitude: -23.55,
          longitude: -46.63,
          type: 'supermarket',
          googlePlaceId: 'ChIJ...',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
        items: [
          {
            id: 'uuid',
            purchaseId: 'uuid',
            productId: 'uuid',
            barcode: '7891234567890',
            price: '4.89',
            quantity: 2,
            fromListId: 'uuid | null',
            product: {
              id: 'uuid',
              name: 'Arroz Tio João 5kg',
              brand: 'Tio João',
              barcode: '7891234567890',
              categoryId: 1,
              subCategoryId: 1,
              unit: 'kg',
              imageUrl: 'https://... | null',
              createdAt: '2026-03-30T00:00:00.000Z',
              updatedAt: '2026-03-30T00:00:00.000Z',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  @ApiResponse({ status: 403, description: 'Purchase belongs to another user' })
  findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.purchasesService.findById(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update purchase status (complete or cancel)' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({
    status: 200,
    description: 'Purchase with updated status',
    schema: {
      example: {
        id: 'uuid',
        userId: 'uuid',
        storeId: 'uuid',
        linkedListId: 'uuid | null',
        status: 'completed',
        createdAt: '2026-03-30T00:00:00.000Z',
        completedAt: '2026-03-30T00:00:00.000Z',
        store: { id: 'uuid', name: 'Supermercado X' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition (purchase not active)',
  })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.updateStatus(id, dto, userId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add an item to a purchase' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({
    status: 201,
    description: 'Purchase item created with product data',
    schema: {
      example: {
        id: 'uuid',
        purchaseId: 'uuid',
        productId: 'uuid',
        barcode: '7891234567890',
        price: '4.89',
        quantity: 2,
        fromListId: 'uuid | null',
        product: {
          id: 'uuid',
          name: 'Arroz Tio João 5kg',
          brand: 'Tio João',
          barcode: '7891234567890',
          categoryId: 1,
          subCategoryId: 1,
          unit: 'kg',
          imageUrl: null,
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Purchase is not active' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  addItem(
    @Param('id') purchaseId: string,
    @Body() dto: AddPurchaseItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.addItem(purchaseId, dto, userId);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update price or quantity of a purchase item' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiParam({ name: 'itemId', description: 'Purchase Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Updated purchase item with product data',
    schema: {
      example: {
        id: 'uuid',
        purchaseId: 'uuid',
        productId: 'uuid',
        barcode: '7891234567890',
        price: '5.49',
        quantity: 3,
        fromListId: null,
        product: {
          id: 'uuid',
          name: 'Arroz Tio João 5kg',
          brand: 'Tio João',
          barcode: '7891234567890',
          categoryId: 1,
          subCategoryId: 1,
          unit: 'kg',
          imageUrl: null,
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Purchase is not active' })
  @ApiResponse({ status: 404, description: 'Purchase or item not found' })
  updateItem(
    @Param('id') purchaseId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePurchaseItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.updateItem(purchaseId, itemId, dto, userId);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item from a purchase' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiParam({ name: 'itemId', description: 'Purchase Item ID' })
  @ApiResponse({
    status: 204,
    description: 'Item removed successfully (no content)',
  })
  @ApiResponse({ status: 400, description: 'Purchase is not active' })
  @ApiResponse({ status: 404, description: 'Purchase or item not found' })
  removeItem(
    @Param('id') purchaseId: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.removeItem(purchaseId, itemId, userId);
  }
}
