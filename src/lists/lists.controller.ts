import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { ListAccessGuard } from '../core/guards/list-access.guard';
import { ListsService } from './lists.service';
import { CreateListDto, UpdateListDto } from './dto';

@ApiTags('Lists')
@ApiBearerAuth()
@Controller('lists')
export class ListsController {
  constructor(private listsService: ListsService) {}

  @Get()
  findUserLists(@CurrentUser('id') userId: string) {
    return this.listsService.findUserLists(userId);
  }

  @Post()
  create(@Body() dto: CreateListDto, @CurrentUser('id') userId: string) {
    return this.listsService.create(dto, userId);
  }

  @Get(':id')
  @UseGuards(ListAccessGuard)
  findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listsService.findById(id, userId);
  }

  @Patch(':id')
  @UseGuards(ListAccessGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.listsService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listsService.delete(id, userId);
  }

  @Get(':id/optimize')
  @UseGuards(ListAccessGuard)
  optimize(@Param('id') id: string) {
    return this.listsService.optimize(id);
  }
}
