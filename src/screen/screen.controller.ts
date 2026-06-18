import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ScreenService } from './screen.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { Role } from '@prisma/client';

@ApiTags('Screens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@Controller('screens')
export class ScreenController {
  constructor(private readonly screenService: ScreenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new screen' })
  create(@Body() dto: CreateScreenDto) {
    return this.screenService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all screens' })
  findAll() {
    return this.screenService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get screen by ID' })
  findOne(@Param('id') id: string) {
    return this.screenService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update screen by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateScreenDto) {
    return this.screenService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete screen by ID' })
  remove(@Param('id') id: string) {
    return this.screenService.remove(id);
  }
}
