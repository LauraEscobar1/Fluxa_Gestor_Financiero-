import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

/** Categorías del usuario autenticado. */
@ApiTags('categories')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lista las categorías propias (por nombre)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorías',
    type: [Category],
  })
  @ApiResponse({ status: 400, description: 'Tipo inválido' })
  findAll(
    @CurrentUser('id') userId: number,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<Category[]> {
    return this.categoriesService.findAll(userId, query.type);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene una categoría propia' })
  @ApiResponse({ status: 200, description: 'Categoría', type: Category })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Category> {
    return this.categoriesService.findOne(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una categoría' })
  @ApiResponse({ status: 201, description: 'Categoría creada', type: Category })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una categoría con ese nombre y tipo',
  })
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.create(userId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia el nombre de una categoría (el tipo no)' })
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada',
    type: Category,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una categoría con ese nombre y tipo',
  })
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una categoría' })
  @ApiResponse({
    status: 200,
    description: 'Categoría eliminada',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Id inválido' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'La categoría tiene transacciones asociadas',
  })
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponseDto> {
    return this.categoriesService.remove(userId, id);
  }
}
