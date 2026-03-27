import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubCategoryDto {
  @ApiProperty({ example: 'Grãos' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 1, description: 'Category ID' })
  @Type(() => Number)
  @IsInt()
  categoryId: number;
}
