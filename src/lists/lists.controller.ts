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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { ListAccessGuard } from '../core/guards/list-access.guard';
import { ListsService } from './lists.service';
import { CreateListDto, UpdateListDto } from './dto';

@ApiTags('Lists')
@ApiBearerAuth()
@Controller('lists')
export class ListsController {
  constructor(private listsService: ListsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get all shopping lists for the authenticated user (owned + shared)',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of shopping lists with item and member counts',
    schema: {
      example: [
        {
          id: 'uuid',
          name: 'Compras da semana',
          ownerId: 'uuid',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
          _count: { items: 12, members: 2 },
          estimatedTotal: 245.8,
        },
      ],
    },
  })
  findUserLists(@CurrentUser('id') userId: string) {
    return this.listsService.findUserLists(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new shopping list' })
  @ApiResponse({
    status: 201,
    description: 'Shopping list created',
    schema: {
      example: {
        id: 'uuid',
        name: 'Compras da semana',
        ownerId: 'uuid',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateListDto, @CurrentUser('id') userId: string) {
    return this.listsService.create(dto, userId);
  }

  @Get(':id')
  @UseGuards(ListAccessGuard)
  @ApiOperation({ summary: 'Get shopping list with items, members and owner' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 200,
    description:
      'Shopping list with all items (including product), members and owner',
    schema: {
      example: {
        id: 'uuid',
        name: 'Compras da semana',
        ownerId: 'uuid',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
        owner: { id: 'uuid', name: 'João Silva', email: 'joao@email.com' },
        members: [
          {
            listId: 'uuid',
            userId: 'uuid',
            role: 'editor',
            joinedAt: '2026-03-30T00:00:00.000Z',
            user: {
              id: 'uuid',
              name: 'Maria Santos',
              email: 'maria@email.com',
            },
          },
        ],
        items: [
          {
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
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Shopping list not found' })
  findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listsService.findById(id, userId);
  }

  @Patch(':id')
  @UseGuards(ListAccessGuard)
  @ApiOperation({ summary: 'Update shopping list name' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Updated shopping list',
    schema: {
      example: {
        id: 'uuid',
        name: 'Compras do mês',
        ownerId: 'uuid',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'No write access to this list' })
  @ApiResponse({ status: 404, description: 'Shopping list not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.listsService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shopping list (owner only)' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 204,
    description: 'List deleted successfully (no content)',
  })
  @ApiResponse({ status: 403, description: 'Only the owner can delete a list' })
  @ApiResponse({ status: 404, description: 'Shopping list not found' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listsService.delete(id, userId);
  }

  @Get(':id/optimize')
  @UseGuards(ListAccessGuard)
  @ApiOperation({
    summary: 'Find the cheapest store for all items in the list',
  })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 200,
    description:
      'Store ranking with total cost, items available/missing, and savings',
    schema: {
      example: {
        listId: 'uuid',
        itemCount: 5,
        stores: [
          {
            storeId: 'uuid',
            storeName: 'Supermercado X',
            totalCost: 89.5,
            itemsAvailable: 5,
            itemsMissing: 0,
            savings: 0,
          },
          {
            storeId: 'uuid',
            storeName: 'Supermercado Y',
            totalCost: 102.3,
            itemsAvailable: 4,
            itemsMissing: 1,
            savings: 12.8,
          },
        ],
        bestStore: {
          storeId: 'uuid',
          storeName: 'Supermercado X',
          totalCost: 89.5,
          savings: 12.8,
        },
      },
    },
  })
  optimize(@Param('id') id: string) {
    return this.listsService.optimize(id);
  }
}
