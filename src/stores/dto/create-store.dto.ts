import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Supermercado Extra' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name: string;

  @ApiProperty({ example: 'Rua das Flores, 123' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  city: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state: string;

  @ApiProperty({ example: -23.5505 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -46.6333 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 'ChIJN1t_tDeuEmsRUsoyG83frY4' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  googlePlaceId?: string;
}
