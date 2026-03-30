import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile with activity counts',
    schema: {
      example: {
        id: 'uuid',
        name: 'João Silva',
        email: 'joao@email.com',
        avatarUrl: 'https://... | null',
        joinedAt: '2026-01-15T00:00:00.000Z',
        _count: { prices: 42, shoppingLists: 5, purchases: 18 },
      },
    },
  })
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile',
    schema: {
      example: {
        id: 'uuid',
        name: 'João Silva',
        email: 'joao@email.com',
        avatarUrl: 'https://...',
        joinedAt: '2026-01-15T00:00:00.000Z',
      },
    },
  })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/savings')
  @ApiOperation({ summary: 'Get user purchase stats and total spent' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated stats: total purchases, prices submitted, and total spent',
    schema: {
      example: {
        totalPurchases: 18,
        totalPricesSubmitted: 42,
        totalSpent: 2345.67,
      },
    },
  })
  getSavings(@CurrentUser('id') userId: string) {
    return this.usersService.getSavings(userId);
  }
}
