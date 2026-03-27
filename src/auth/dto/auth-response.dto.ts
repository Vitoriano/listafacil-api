import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  joinedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}
