import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
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
}
