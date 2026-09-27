import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class NearbyPlacesQueryDto {
  @ApiProperty({ example: -5.79 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -35.21 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ description: 'next_page_token da página anterior' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pageToken?: string;
}

export class SearchPlacesQueryDto {
  @ApiProperty({ example: 'nordestão' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q: string;

  @ApiProperty({ example: -5.79 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -35.21 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
