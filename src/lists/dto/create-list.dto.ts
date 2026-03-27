import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateListDto {
  @ApiProperty({ example: 'Compras da semana' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;
}
