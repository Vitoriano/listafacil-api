import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ListAccessGuard } from '../../core/guards/list-access.guard';
import { ListMembersService } from './list-members.service';

@ApiTags('List Members')
@ApiBearerAuth()
@UseGuards(ListAccessGuard)
@Controller('lists/:id/members')
export class ListMembersController {
  constructor(private listMembersService: ListMembersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all members of a shopping list' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Owner and members of the list',
    schema: {
      example: {
        owner: { id: 'uuid', name: 'João Silva', email: 'joao@email.com' },
        members: [
          {
            userId: 'uuid',
            name: 'Maria Santos',
            email: 'maria@email.com',
            role: 'editor',
            joinedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Shopping list not found' })
  getMembers(@Param('id') listId: string) {
    return this.listMembersService.getMembers(listId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the list (owner or self)' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiParam({ name: 'userId', description: 'User ID of the member to remove' })
  @ApiResponse({
    status: 204,
    description: 'Member removed successfully (no content)',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the owner can remove other members',
  })
  @ApiResponse({
    status: 404,
    description: 'Shopping list or member not found',
  })
  removeMember(
    @Param('id') listId: string,
    @Param('userId') memberUserId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.listMembersService.removeMember(
      listId,
      memberUserId,
      currentUserId,
    );
  }
}
