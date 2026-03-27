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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { PaginationQueryDto } from '../core/dto/pagination-query.dto';
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  AddPurchaseItemDto,
  UpdatePurchaseItemDto,
} from './dto';

@ApiTags('Purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.purchasesService.findAll(userId, query);
  }

  @Get('recent')
  findRecent(@CurrentUser('id') userId: string) {
    return this.purchasesService.findRecent(userId);
  }

  @Post()
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.create(dto, userId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.purchasesService.findById(id, userId);
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.updateStatus(id, dto, userId);
  }

  @Post(':id/items')
  addItem(
    @Param('id') purchaseId: string,
    @Body() dto: AddPurchaseItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.addItem(purchaseId, dto, userId);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') purchaseId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePurchaseItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.updateItem(purchaseId, itemId, dto, userId);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @Param('id') purchaseId: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.removeItem(purchaseId, itemId, userId);
  }
}
