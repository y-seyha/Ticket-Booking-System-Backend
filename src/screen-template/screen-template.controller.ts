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

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { ScreenTemplateService } from './screen-template.service';
import { CreateScreenTemplateDto } from './dto/create-screen-template.dto';
import { UpdateScreenTemplateDto } from './dto/update-screen-template.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { Role } from '@prisma/client';

@Roles(Role.ADMIN)
@ApiTags('Screen Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('screen-templates')
export class ScreenTemplateController {
  constructor(private readonly service: ScreenTemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Create screen template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  create(@Body() dto: CreateScreenTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all screen templates' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id/active')
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get screen template by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update screen template' })
  update(@Param('id') id: string, @Body() dto: UpdateScreenTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete screen template' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
