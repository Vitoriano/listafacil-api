import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface NearbyPlace {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface NearbyPlacesResult {
  /** false quando a API não tem chave do Google configurada. */
  available: boolean;
  places: NearbyPlace[];
  nextPageToken?: string;
}

export interface PlaceDetails extends NearbyPlace {
  city: string;
  state: string;
}

interface RawPlace {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  business_status?: string;
  geometry?: { location?: { lat: number; lng: number } };
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';
/** Célula de cache: 0.005° ≈ 550 m. Vizinhos do mesmo bairro reaproveitam a busca. */
const CELL_SIZE_DEG = 0.005;
const NEARBY_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const DETAILS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TEXT_SEARCH_RADIUS_M = 50_000;
/** O Google só aceita next_page_token ~2 s depois de emiti-lo. */
const PAGE_TOKEN_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cellKey(lat: number, lng: number): string {
  const snap = (v: number) =>
    (Math.round(v / CELL_SIZE_DEG) * CELL_SIZE_DEG).toFixed(3);
  return `${snap(lat)}:${snap(lng)}`;
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function normalizeQuery(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function mapRawPlaces(results: RawPlace[] | undefined): NearbyPlace[] {
  return (results ?? [])
    .filter((r) => r.business_status !== 'CLOSED_PERMANENTLY')
    .filter((r) => r.geometry?.location)
    .map((r) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.vicinity ?? r.formatted_address ?? '',
      latitude: r.geometry!.location!.lat,
      longitude: r.geometry!.location!.lng,
    }));
}

export function extractCityState(components: AddressComponent[] | undefined) {
  let city = '';
  let state = '';
  for (const c of components ?? []) {
    const types = c.types ?? [];
    if (
      types.includes('administrative_area_level_2') ||
      types.includes('locality')
    ) {
      city = c.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      state = c.short_name;
    }
  }
  return { city, state };
}

/**
 * Google Places no servidor: a chave fica fora do app e cada busca é cacheada no
 * Redis por célula de ~550 m, então todos os usuários do mesmo bairro dividem
 * uma única chamada por 24 h.
 */
@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey: string;

  constructor(
    config: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = config.get<string>('GOOGLE_PLACES_API_KEY', '').trim();
    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_PLACES_API_KEY não definida: busca de mercados no Google desativada',
      );
    }
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async nearbySupermarkets(
    lat: number,
    lng: number,
    pageToken?: string,
  ): Promise<NearbyPlacesResult> {
    if (!this.isAvailable) return { available: false, places: [] };

    const cacheKey = `places:nearby:${cellKey(lat, lng)}:${
      pageToken ? shortHash(pageToken) : 'p1'
    }`;
    const cached = await this.cacheManager.get<NearbyPlacesResult>(cacheKey);
    if (cached) return cached;

    const params = pageToken
      ? new URLSearchParams({ pagetoken: pageToken, key: this.apiKey })
      : new URLSearchParams({
          location: `${lat},${lng}`,
          rankby: 'distance',
          type: 'supermarket',
          language: 'pt-BR',
          key: this.apiKey,
        });

    if (pageToken) await sleep(PAGE_TOKEN_DELAY_MS);

    let json = await this.request<{
      next_page_token?: string;
      results?: RawPlace[];
    }>('nearbysearch', params);
    if (pageToken && json.status === 'INVALID_REQUEST') {
      await sleep(PAGE_TOKEN_DELAY_MS);
      json = await this.request('nearbysearch', params);
    }
    this.assertOk(json, 'nearbysearch');

    const result: NearbyPlacesResult = {
      available: true,
      places: mapRawPlaces(json.results),
      nextPageToken: json.next_page_token,
    };
    await this.cacheManager.set(cacheKey, result, NEARBY_TTL_MS);
    return result;
  }

  async searchByName(
    query: string,
    lat: number,
    lng: number,
  ): Promise<NearbyPlacesResult> {
    if (!this.isAvailable) return { available: false, places: [] };

    const q = normalizeQuery(query);
    const cacheKey = `places:search:${cellKey(lat, lng)}:${shortHash(q)}`;
    const cached = await this.cacheManager.get<NearbyPlacesResult>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      query: q,
      location: `${lat},${lng}`,
      radius: String(TEXT_SEARCH_RADIUS_M),
      type: 'supermarket',
      language: 'pt-BR',
      key: this.apiKey,
    });
    const json = await this.request<{ results?: RawPlace[] }>(
      'textsearch',
      params,
    );
    this.assertOk(json, 'textsearch');

    const result: NearbyPlacesResult = {
      available: true,
      places: mapRawPlaces(json.results),
    };
    await this.cacheManager.set(cacheKey, result, SEARCH_TTL_MS);
    return result;
  }

  async details(placeId: string): Promise<PlaceDetails> {
    if (!this.isAvailable) {
      throw new ServiceUnavailableException(
        'Busca de mercados no Google indisponível',
      );
    }

    const cacheKey = `places:details:${placeId}`;
    const cached = await this.cacheManager.get<PlaceDetails>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'place_id,name,formatted_address,address_component,geometry',
      language: 'pt-BR',
      key: this.apiKey,
    });
    const json = await this.request<{
      result?: RawPlace & { address_components?: AddressComponent[] };
    }>('details', params);
    if (json.status !== 'OK' || !json.result?.geometry?.location) {
      this.logger.warn(
        `details ${placeId}: ${json.status} ${json.error_message ?? ''}`,
      );
      throw new ServiceUnavailableException('Não foi possível obter o lugar');
    }

    const { result } = json;
    const { city, state } = extractCityState(result.address_components);
    const details: PlaceDetails = {
      placeId: result.place_id,
      name: result.name,
      address: result.formatted_address ?? result.vicinity ?? '',
      city,
      state,
      latitude: result.geometry!.location!.lat,
      longitude: result.geometry!.location!.lng,
    };
    await this.cacheManager.set(cacheKey, details, DETAILS_TTL_MS);
    return details;
  }

  private async request<T>(
    endpoint: 'nearbysearch' | 'textsearch' | 'details',
    params: URLSearchParams,
  ): Promise<T & { status: string; error_message?: string }> {
    const response = await fetch(
      `${BASE_URL}/${endpoint}/json?${params.toString()}`,
    );
    return (await response.json()) as T & {
      status: string;
      error_message?: string;
    };
  }

  private assertOk(
    json: { status: string; error_message?: string },
    endpoint: string,
  ) {
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      this.logger.warn(
        `${endpoint}: ${json.status} ${json.error_message ?? ''}`,
      );
      throw new ServiceUnavailableException(
        'Busca de mercados no Google indisponível no momento',
      );
    }
  }
}
