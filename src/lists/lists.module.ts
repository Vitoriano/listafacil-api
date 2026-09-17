import { Module } from '@nestjs/common';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ListItemsController } from './items/list-items.controller';
import { ListItemsService } from './items/list-items.service';
import { ListMembersController } from './members/list-members.controller';
import { ListMembersService } from './members/list-members.service';
import { InvitesController } from './invites/invites.controller';
import { InvitesService } from './invites/invites.service';

@Module({
  controllers: [
    ListsController,
    ListItemsController,
    ListMembersController,
    InvitesController,
  ],
  providers: [
    ListsService,
    ListItemsService,
    ListMembersService,
    InvitesService,
  ],
  exports: [ListsService],
})
export class ListsModule {}
