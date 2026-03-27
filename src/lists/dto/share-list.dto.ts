import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ShareRole } from '@prisma/client';

export class ShareByEmailDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ShareRole, default: 'viewer' })
  @IsOptional()
  @IsEnum(ShareRole)
  role?: ShareRole;
}

export class GenerateInviteDto {
  @ApiPropertyOptional({ enum: ShareRole, default: 'viewer' })
  @IsOptional()
  @IsEnum(ShareRole)
  role?: ShareRole;
}
