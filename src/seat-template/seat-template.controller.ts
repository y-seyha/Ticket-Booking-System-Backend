import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { SeatTemplateService } from './seat-template.service';
import { GenerateTemplateSeatsDto } from './dto/generate-template-seat.dto';

@ApiTags('Template Seats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('template-seats')
export class SeatTemplateController {
  constructor(private readonly service: SeatTemplateService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate screen template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  generate(@Body() dto: GenerateTemplateSeatsDto) {
    return this.service.generateBulk(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all template seats' })
  findAll() {
    return this.service.findAll();
  }

  @Get('/template/:templateId')
  @ApiOperation({ summary: 'Get seats by template' })
  findByTemplate(@Param('templateId') templateId: string) {
    return this.service.findByTemplate(templateId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template seat by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
