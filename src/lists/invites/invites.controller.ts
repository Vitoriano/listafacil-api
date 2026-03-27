import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  generateInvite(
    @Param('id') listId: string,
    @Body() dto: GenerateInviteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitesService.generateInviteLink(listId, dto, userId);
  }

  @Public()
  @Get('invites/:inviteId')
  getInvite(@Param('inviteId') inviteId: string) {
    return this.invitesService.getInvite(inviteId);
  }

  @ApiBearerAuth()
  @Post('invites/:inviteId/join')
  acceptInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitesService.acceptInvite(inviteId, userId);
  }
}
