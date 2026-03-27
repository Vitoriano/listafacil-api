import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Mercearia' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;
}
