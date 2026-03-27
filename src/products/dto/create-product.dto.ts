import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProductCategory } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'Leite Integral' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name: string;

  @ApiProperty({ example: 'Parmalat' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  brand: string;

  @ApiProperty({ example: '7891234567890' })
  @IsString()
  @Length(8, 14)
  barcode: string;

  @ApiPropertyOptional({ enum: ProductCategory, default: 'other' })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiProperty({ example: '1L' })
  @IsString()
  @MaxLength(50)
  unit: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
