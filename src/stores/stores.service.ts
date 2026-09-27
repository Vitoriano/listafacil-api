import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { PaginatedResponse } from '../core/dto/paginated-response.dto';
import { CreateStoreDto, ListStoresQueryDto } from './dto';
import { GooglePlacesService } from './google-places.service';

const DEFAULT_RADIUS_KM = 50;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private places: GooglePlacesService,
  ) {}

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

    // Busca por proximidade: ordena por distância e limita ao raio informado.
    if (query.lat !== undefined && query.lng !== undefined) {
      return this.findNearby(where, query);
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

  /**
   * Lojas dentro do raio, mais próximas primeiro, com `distanceKm` em cada item.
   * A tabela de lojas é pequena, então o cálculo é feito em memória (Haversine).
   */
  private async findNearby(
    where: Prisma.StoreWhereInput,
    query: ListStoresQueryDto,
  ) {
    const lat = query.lat as number;
    const lng = query.lng as number;
    const radiusKm = query.radiusKm ?? DEFAULT_RADIUS_KM;

    const stores = await this.prisma.store.findMany({ where });

    const nearby = stores
      .map((store) => ({
        ...store,
        distanceKm:
          Math.round(
            haversineKm(lat, lng, store.latitude, store.longitude) * 100,
          ) / 100,
      }))
      .filter((store) => store.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const data = nearby.slice(query.skip, query.skip + query.limit);
    return new PaginatedResponse(data, nearby.length, query.page, query.limit);
  }

  async findById(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  /**
   * Cadastra (uma única vez) uma loja a partir de um lugar do Google.
   * Se já existir com esse googlePlaceId, devolve a existente sem chamar o Google.
   */
  async createFromPlace(placeId: string) {
    const existing = await this.prisma.store.findUnique({
      where: { googlePlaceId: placeId },
    });
    if (existing) return existing;

    const details = await this.places.details(placeId);
    return this.create({
      name: details.name,
      address: details.address,
      city: details.city || 'Desconhecida',
      state: (details.state || 'NA').slice(0, 2).toUpperCase(),
      latitude: details.latitude,
      longitude: details.longitude,
      googlePlaceId: placeId,
    });
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
