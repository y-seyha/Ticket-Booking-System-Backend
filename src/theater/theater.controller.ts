import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { TheaterService } from './theater.service';
import { CreateTheaterDto } from './dto/create-theater.dto';
import { UpdateTheaterDto } from './dto/update-theater.dto';
import { TheaterQueryDto } from './dto/theater-query.dto';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';

import { Role } from '@prisma/client';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';

@ApiTags('Theater')
@Controller('theaters')
export class TheaterController {
  constructor(private readonly theaterService: TheaterService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a theater (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('theaters', { storage: memoryStorage() }))
  @ApiBody({
    description: 'Create theater with optional image upload',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        location: { type: 'string' },
        city: { type: 'string' },
        status: { type: 'string', example: 'ACTIVE' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateTheaterDto,
    @CurrentUser() user: any,
  ) {
    return this.theaterService.create(dto, file, user.id);
  }

  @Get(':id/movies')
  @ApiOperation({ summary: 'Get grouped movie showtimes using Theater ID' })
  async getTheaterMovies(
    @Param('id') theaterId: string,
    @Query('date') date?: string,
  ) {
    return this.theaterService.findMoviesByTheaterAndDate(theaterId, date);
  }

  @Get()
  @ApiOperation({ summary: 'Get all theaters with pagination & filters' })
  @ApiResponse({ status: 200, description: 'List of theaters' })
  async findAll(@Query() query: TheaterQueryDto) {
    return this.theaterService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get theater by ID' })
  @ApiResponse({ status: 200, description: 'Theater found' })
  @ApiResponse({ status: 404, description: 'Theater not found' })
  async findOne(@Param('id') id: string) {
    return this.theaterService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update theater (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('theaters', { storage: memoryStorage() }))
  @ApiBody({
    description: 'Update theater with optional image upload',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        location: { type: 'string' },
        city: { type: 'string' },
        status: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTheaterDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.theaterService.update(id, dto, file, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete theater (Admin only)' })
  @ApiResponse({ status: 200, description: 'Theater deleted' })
  async remove(@Param('id') id: string) {
    return this.theaterService.remove(id);
  }
}
