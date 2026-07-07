import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SeatTemplateService } from './seat-template.service';
import { GenerateTemplateSeatsDto } from './dto/generate-template-seat.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { UpdateTemplateLayoutDto } from './dto/update-template.dto';

@ApiTags('Template Seats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // Toggle or keep dependent on your global settings
@Controller('template-seats')
export class SeatTemplateController {
  constructor(private readonly service: SeatTemplateService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate or completely reset screen template seat configurations',
  })
  @ApiResponse({
    status: 201,
    description: 'Template seats generated successfully',
  })
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

  @Patch('/template/:templateId/layout/:layoutId')
  @ApiOperation({
    summary: 'Modify a layout metadata or regenerate seat patterns',
  })
  @ApiResponse({
    status: 200,
    description: 'Layout schema altered successfully',
  })
  updateLayout(
    @Param('templateId') templateId: string,
    @Param('layoutId') layoutId: string,
    @Body() dto: UpdateTemplateLayoutDto,
  ) {
    return this.service.updateLayout(templateId, layoutId, dto);
  }

  @Delete('/template/:templateId/layout/:layoutId')
  @ApiOperation({ summary: 'Delete a layout variant completely' })
  @ApiResponse({
    status: 200,
    description: 'Layout variant deleted successfully',
  })
  deleteLayout(
    @Param('templateId') templateId: string,
    @Param('layoutId') layoutId: string,
  ) {
    return this.service.deleteLayout(templateId, layoutId);
  }
}
