import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { ListAccessGuard } from '../../core/guards/list-access.guard';
import { InvitesService } from './invites.service';
import { ShareByEmailDto, GenerateInviteDto } from '../dto';

@ApiTags('Invites')
@Controller()
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  @ApiBearerAuth()
  @UseGuards(ListAccessGuard)
  @Post('lists/:id/share/email')
  @ApiOperation({
    summary:
      'Share a list by email (adds directly if user exists, creates invite otherwise)',
  })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'User added directly or invite created',
    schema: {
      examples: {
        userExists: {
          summary: 'User found and added as member',
          value: { joined: true, userId: 'uuid' },
        },
        userNotFound: {
          summary: 'Invite created for email',
          value: { joined: false, inviteId: 'uuid' },
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  shareByEmail(
    @Param('id') listId: string,
    @Body() dto: ShareByEmailDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitesService.shareByEmail(listId, dto, userId);
  }

  @ApiBearerAuth()
  @UseGuards(ListAccessGuard)
  @Post('lists/:id/share/invite')
  @ApiOperation({ summary: 'Generate an invite link for a shopping list' })
  @ApiParam({ name: 'id', description: 'Shopping List ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'Invite link generated',
    schema: {
      example: { inviteId: 'uuid' },
    },
  })
  generateInvite(
    @Param('id') listId: string,
    @Body() dto: GenerateInviteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitesService.generateInviteLink(listId, dto, userId);
  }

  @Public()
  @Get('invites/:inviteId')
  @ApiOperation({ summary: 'Get invite details (public, no auth required)' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Invite details with list and inviter info',
    schema: {
      example: {
        id: 'uuid',
        listId: 'uuid',
        invitedBy: 'uuid',
        email: 'maria@email.com | null',
        role: 'viewer',
        accepted: false,
        createdAt: '2026-03-30T00:00:00.000Z',
        expiresAt: '2026-04-06T00:00:00.000Z',
        list: { id: 'uuid', name: 'Compras da semana' },
        inviter: { id: 'uuid', name: 'João Silva' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Invite has expired' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  getInvite(@Param('inviteId') inviteId: string) {
    return this.invitesService.getInvite(inviteId);
  }

  @ApiBearerAuth()
  @Post('invites/:inviteId/join')
  @ApiOperation({ summary: 'Accept an invite and join the shopping list' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID (UUID)' })
  @ApiResponse({
    status: 201,
    description: 'Invite accepted, user joined the list',
    schema: {
      example: { listId: 'uuid', role: 'viewer' },
    },
  })
  @ApiResponse({ status: 403, description: 'Invite has expired' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  @ApiResponse({
    status: 409,
    description: 'Invite already accepted or user already a member',
  })
  acceptInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitesService.acceptInvite(inviteId, userId);
  }
}
