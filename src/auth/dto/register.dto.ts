import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ example: 'senha1234' })
  @IsString()
  @MinLength(8)
  password: string;
}
