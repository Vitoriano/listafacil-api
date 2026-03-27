import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class SubmitPriceDto {
  @ApiProperty()
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 4.89 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999.99)
  price: number;
}
