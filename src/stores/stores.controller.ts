import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, ListStoresQueryDto } from './dto';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'List stores with optional filters (city, state, type)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of stores',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            name: 'Supermercado X',
            address: 'Rua das Flores, 123',
            city: 'São Paulo',
            state: 'SP',
            latitude: -23.5505,
            longitude: -46.6333,
            type: 'supermarket',
            googlePlaceId: 'ChIJ... | null',
            createdAt: '2026-03-30T00:00:00.000Z',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  findAll(@Query() query: ListStoresQueryDto) {
    return this.storesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get store by ID' })
  @ApiParam({ name: 'id', description: 'Store ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Store details',
    schema: {
      example: {
        id: 'uuid',
        name: 'Supermercado X',
        address: 'Rua das Flores, 123',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5505,
        longitude: -46.6333,
        type: 'supermarket',
        googlePlaceId: 'ChIJ...',
        createdAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  findById(@Param('id') id: string) {
    return this.storesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a store (or return existing if duplicate)' })
  @ApiResponse({
    status: 201,
    description: 'Store created or existing store returned',
    schema: {
      example: {
        id: 'uuid',
        name: 'Supermercado X',
        address: 'Rua das Flores, 123',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5505,
        longitude: -46.6333,
        type: 'supermarket',
        googlePlaceId: 'ChIJ...',
        createdAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }
}
