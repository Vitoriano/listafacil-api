import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ example: 1, description: 'Category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ example: 1, description: 'SubCategory ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subCategoryId?: number;

  @ApiProperty({ example: '1L' })
  @IsString()
  @MaxLength(50)
  unit: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
