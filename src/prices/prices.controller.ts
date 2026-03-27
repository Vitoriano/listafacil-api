import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { PaginationQueryDto } from '../core/dto/pagination-query.dto';
import { PricesService } from './prices.service';
import { SubmitPriceDto, ValidatePriceDto, PriceHistoryQueryDto } from './dto';

@ApiTags('Prices')
@ApiBearerAuth()
@Controller()
export class PricesController {
  constructor(private pricesService: PricesService) {}

  @Post('products/:productId/prices')
  submitPrice(
    @Param('productId') productId: string,
    @Body() dto: SubmitPriceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pricesService.submitPrice(productId, dto, userId);
  }

  @Get('products/:productId/prices')
  getProductPrices(
    @Param('productId') productId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.pricesService.getProductPrices(productId, query);
  }

  @Get('products/:productId/prices/comparison')
  getComparison(@Param('productId') productId: string) {
    return this.pricesService.getComparison(productId);
  }

  @Get('products/:productId/prices/history')
  getPriceHistory(
    @Param('productId') productId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.pricesService.getPriceHistory(productId, query);
  }

  @Post('prices/:priceId/validate')
  @HttpCode(HttpStatus.NO_CONTENT)
  validatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: ValidatePriceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pricesService.validatePrice(priceId, dto, userId);
  }
}
