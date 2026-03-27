import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListAccessGuard } from '../../core/guards/list-access.guard';
import { ListItemsService } from './list-items.service';
import { AddListItemDto, UpdateListItemDto } from '../dto';

@ApiTags('List Items')
@ApiBearerAuth()
@UseGuards(ListAccessGuard)
@Controller('lists/:id/items')
export class ListItemsController {
  constructor(private listItemsService: ListItemsService) {}

  @Post()
  addItem(@Param('id') listId: string, @Body() dto: AddListItemDto) {
    return this.listItemsService.addItem(listId, dto);
  }

  @Patch(':itemId')
  updateItem(
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.listItemsService.updateItem(listId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param('id') listId: string, @Param('itemId') itemId: string) {
    return this.listItemsService.removeItem(listId, itemId);
  }
}
