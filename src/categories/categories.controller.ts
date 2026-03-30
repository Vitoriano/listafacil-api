import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, CreateSubCategoryDto } from './dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories with their subcategories' })
  @ApiResponse({
    status: 200,
    description: 'Array of categories with nested subcategories',
    schema: {
      example: [
        {
          id: 1,
          name: 'Alimentos',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
          subCategories: [
            {
              id: 1,
              name: 'Grãos',
              categoryId: 1,
              createdAt: '2026-03-30T00:00:00.000Z',
              updatedAt: '2026-03-30T00:00:00.000Z',
            },
            {
              id: 2,
              name: 'Laticínios',
              categoryId: 1,
              createdAt: '2026-03-30T00:00:00.000Z',
              updatedAt: '2026-03-30T00:00:00.000Z',
            },
          ],
        },
      ],
    },
  })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID with subcategories' })
  @ApiParam({ name: 'id', description: 'Category ID (integer)' })
  @ApiResponse({
    status: 200,
    description: 'Category with nested subcategories',
    schema: {
      example: {
        id: 1,
        name: 'Alimentos',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
        subCategories: [
          {
            id: 1,
            name: 'Grãos',
            categoryId: 1,
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findById(id);
  }

  @Get(':id/sub-categories')
  @ApiOperation({ summary: 'List subcategories of a category' })
  @ApiParam({ name: 'id', description: 'Category ID (integer)' })
  @ApiResponse({
    status: 200,
    description: 'Array of subcategories',
    schema: {
      example: [
        {
          id: 1,
          name: 'Grãos',
          categoryId: 1,
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findSubCategories(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findSubCategoriesByCategoryId(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({
    status: 201,
    description: 'Category created',
    schema: {
      example: {
        id: 3,
        name: 'Bebidas',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Post('sub-categories')
  @ApiOperation({ summary: 'Create a new subcategory' })
  @ApiResponse({
    status: 201,
    description: 'Subcategory created',
    schema: {
      example: {
        id: 5,
        name: 'Sucos',
        categoryId: 3,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  createSubCategory(@Body() dto: CreateSubCategoryDto) {
    return this.categoriesService.createSubCategory(dto);
  }
}
