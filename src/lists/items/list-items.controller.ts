import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ListAccessGuard } from '../../core/guards/list-access.guard';
import { ListItemsService } from './list-items.service';
import { AddListItemDto, UpdateListItemDto } from '../dto';

@ApiTags('List Items')
@ApiBearerAuth()
@UseGuards(ListAccessGuard)
@Controller('lists/:id/items')
export class ListItemsController {
  constructor(private listItemsService: ListItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Add an item to a shopping list' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'List item created with product data',
    schema: {
      example: {
        id: 'uuid',
        listId: 'uuid',
        productId: 'uuid',
        quantity: 2,
        estimatedPrice: '25.90',
        checked: false,
        createdAt: '2026-03-30T00:00:00.000Z',
        product: {
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
          latestPrice: {
            id: 'uuid',
            price: '25.90',
            storeId: 'uuid',
            submittedAt: '2026-03-30T00:00:00.000Z',
            store: { id: 'uuid', name: 'Supermercado X' },
          },
        },
      },
    },
  })
  addItem(@Param('id') listId: string, @Body() dto: AddListItemDto) {
    return this.listItemsService.addItem(listId, dto);
  }

  @Patch(':itemId')
  @ApiOperation({
    summary: 'Update a list item (quantity, estimated price, checked)',
  })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiParam({ name: 'itemId', description: 'List Item ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Updated list item with product data',
    schema: {
      example: {
        id: 'uuid',
        listId: 'uuid',
        productId: 'uuid',
        quantity: 3,
        estimatedPrice: '25.90',
        checked: true,
        createdAt: '2026-03-30T00:00:00.000Z',
        product: {
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
          latestPrice: {
            id: 'uuid',
            price: '25.90',
            storeId: 'uuid',
            submittedAt: '2026-03-30T00:00:00.000Z',
            store: { id: 'uuid', name: 'Supermercado X' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'List item not found' })
  updateItem(
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.listItemsService.updateItem(listId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item from a shopping list' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiParam({ name: 'itemId', description: 'List Item ID (UUID)' })
  @ApiResponse({
    status: 204,
    description: 'Item removed successfully (no content)',
  })
  @ApiResponse({ status: 404, description: 'List item not found' })
  removeItem(@Param('id') listId: string, @Param('itemId') itemId: string) {
    return this.listItemsService.removeItem(listId, itemId);
  }
}
