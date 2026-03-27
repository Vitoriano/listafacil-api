import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, ListStoresQueryDto } from './dto';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  findAll(@Query() query: ListStoresQueryDto) {
    return this.storesService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.storesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }
}
