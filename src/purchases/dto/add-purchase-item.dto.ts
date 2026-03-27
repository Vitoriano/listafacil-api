import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class AddPurchaseItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '7891234567890' })
  @IsString()
  @Length(8, 14)
  barcode: string;

  @ApiProperty({ example: 4.89 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999.99)
  price: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromListId?: string;
}
