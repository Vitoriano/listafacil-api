import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { StoreType } from '@prisma/client';
import { PaginationQueryDto } from '../../core/dto/pagination-query.dto';

export class ListStoresQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  @ApiPropertyOptional({ enum: StoreType })
  @IsOptional()
  @IsEnum(StoreType)
  type?: StoreType;

  @ApiPropertyOptional({
    example: -23.5505,
    description: 'Latitude do usuário (com lng, ordena por distância)',
  })
  @ValidateIf(
    (o: ListStoresQueryDto) => o.lat !== undefined || o.lng !== undefined,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({
    example: -46.6333,
    description: 'Longitude do usuário (com lat, ordena por distância)',
  })
  @ValidateIf(
    (o: ListStoresQueryDto) => o.lat !== undefined || o.lng !== undefined,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    default: 50,
    minimum: 1,
    maximum: 500,
    description: 'Raio em km (só com lat/lng)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;
}
