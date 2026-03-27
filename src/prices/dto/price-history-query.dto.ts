import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PriceHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
