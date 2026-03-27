import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PurchaseStatus } from '@prisma/client';

export class UpdatePurchaseDto {
  @ApiProperty({ enum: ['completed', 'cancelled'] })
  @IsEnum(PurchaseStatus)
  status: PurchaseStatus;
}
