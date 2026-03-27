import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  getMembers(@Param('id') listId: string) {
    return this.listMembersService.getMembers(listId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
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
