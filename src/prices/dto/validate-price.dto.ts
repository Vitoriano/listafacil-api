import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ValidatePriceDto {
  @ApiProperty()
  @IsBoolean()
  isValid: boolean;
}
