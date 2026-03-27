import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty()
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedListId?: string;
}
