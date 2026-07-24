import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { PermissionsGuard } from '../authentication/guards/permissions.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { Permissions } from '../authentication/decorators/permissions.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('ADMIN')
  @Permissions('canManageUsers')
  @UseGuards(RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all settings grouped by category' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  @Roles('ADMIN')
  @Permissions('canManageUsers')
  @UseGuards(RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get a single setting' })
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Put()
  @Roles('ADMIN')
  @Permissions('canManageUsers')
  @UseGuards(RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Bulk update settings' })
  updateAll(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateAll(dto);
  }
}
