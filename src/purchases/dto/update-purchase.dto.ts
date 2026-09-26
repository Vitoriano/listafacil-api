import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { PurchaseStatus } from '@prisma/client';

export class UpdatePurchaseDto {
  @ApiPropertyOptional({
    enum: ['completed', 'cancelled'],
    description: 'Finaliza ou cancela a compra (somente compras ativas)',
  })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Vincula (uuid) ou desvincula (null) uma lista de compras à compra ativa',
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  linkedListId?: string | null;
}
