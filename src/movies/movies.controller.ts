import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';

import { RolesGuard } from '../authentication/guards/roles.guard';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { PermissionsGuard } from '../authentication/guards/permissions.guard';
import { Permissions } from '../authentication/decorators/permissions.decorator';
import { MovieQueryDto } from './dto/ movie-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { memoryStorage } from 'multer';
import { UpdateMovieStatusDto } from './dto/update-status.dto';

@ApiTags('Movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @UseGuards(PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create movie with poster upload' })
  @UseInterceptors(
    FileInterceptor('poster', {
      storage: memoryStorage(),
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMovieDto,
    @CurrentUser() user: any,
  ) {
    return this.moviesService.create(dto, file, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @UseGuards(PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually update movie status (Admin only)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMovieStatusDto) {
    return this.moviesService.updateStatus(id, dto.status);
  }

  @Get()
  @ApiOperation({ summary: 'Get all movies with pagination & filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query() query: MovieQueryDto) {
    return this.moviesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get movie by ID' })
  @ApiResponse({ status: 200, description: 'Movie found' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  findOne(@Param('id') id: string, @Query('date') date?: string) {
    return this.moviesService.findOne(id, date);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @UseGuards(PermissionsGuard)
  @UseInterceptors(FileInterceptor('poster'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update movie (Admin only)' })
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateMovieDto,
    @CurrentUser() user: any,
  ) {
    return this.moviesService.update(id, dto, file, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @UseGuards(PermissionsGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete movie (Admin only)' })
  remove(@Param('id') id: string) {
    return this.moviesService.remove(id);
  }
}
