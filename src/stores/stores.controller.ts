import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StoresService } from './stores.service';
import {
  CreateStoreDto,
  ListStoresQueryDto,
  NearbyPlacesQueryDto,
  SearchPlacesQueryDto,
} from './dto';
import { GooglePlacesService } from './google-places.service';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(
    private storesService: StoresService,
    private googlePlaces: GooglePlacesService,
  ) {}

  @Get('places/nearby')
  @ApiOperation({
    summary:
      'Supermarkets near a point via Google Places (server-side, cached)',
    description:
      '20 nearest supermarkets per page, cached in Redis per ~550 m cell for 24 h. ' +
      'Pass `pageToken` to get the next page (max 3 pages). `available: false` when the ' +
      'server has no Google key.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        available: true,
        places: [
          {
            placeId: 'ChIJ...',
            name: 'Nordestão Tirol',
            address: 'Av. Prudente de Morais, 1140 - Tirol',
            latitude: -5.79,
            longitude: -35.21,
          },
        ],
        nextPageToken: 'Aap_...',
      },
    },
  })
  nearbyPlaces(@Query() query: NearbyPlacesQueryDto) {
    return this.googlePlaces.nearbySupermarkets(
      query.lat,
      query.lng,
      query.pageToken,
    );
  }

  @Get('places/search')
  @ApiOperation({
    summary:
      'Search supermarkets by name near a point (Google Text Search, cached)',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { available: true, places: [] } },
  })
  searchPlaces(@Query() query: SearchPlacesQueryDto) {
    return this.googlePlaces.searchByName(query.q, query.lat, query.lng);
  }

  @Post('places/:placeId')
  @ApiOperation({
    summary: 'Register (once) a store from a Google place id and return it',
    description:
      'Idempotent: returns the existing store when the place was already registered. ' +
      'Otherwise fetches place details on the server and creates the store.',
  })
  @ApiParam({ name: 'placeId', description: 'Google Place ID' })
  @ApiResponse({ status: 201, description: 'Store (existing or created)' })
  @ApiResponse({ status: 503, description: 'Google Places unavailable' })
  createFromPlace(@Param('placeId') placeId: string) {
    return this.storesService.createFromPlace(placeId);
  }

  @Get()
  @ApiOperation({
    summary: 'List stores with optional filters (city, state, type)',
    description:
      'With `lat` and `lng` the result is restricted to `radiusKm` (default 50) and ' +
      'sorted by distance; each item then includes `distanceKm`.',
  })
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
