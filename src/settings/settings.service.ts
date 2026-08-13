import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    this.logger.log('Fetching all settings');
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, typeof settings> = {};
    for (const setting of settings) {
      if (!grouped[setting.category]) grouped[setting.category] = [];
      grouped[setting.category].push(setting);
    }

    return grouped;
  }

  async findOne(key: string) {
    this.logger.log(`Fetching setting: ${key}`);
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting;
  }

  async updateAll(dto: UpdateSettingsDto) {
    this.logger.log(`Updating ${Object.keys(dto.settings).length} settings`);
    const results: Record<string, any> = {};

    for (const [key, value] of Object.entries(dto.settings)) {
      const existing = await this.prisma.systemSetting.findUnique({
        where: { key },
      });
      if (existing) {
        results[key] = await this.prisma.systemSetting.update({
          where: { key },
          data: { value: String(value) },
        });
      }
    }

    return results;
  }
}
