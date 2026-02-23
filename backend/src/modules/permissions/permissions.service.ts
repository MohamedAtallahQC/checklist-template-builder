import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException } from '../../common/exceptions';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findAllRules() {
    return this.prisma.permissionRule.findMany({
      orderBy: { priority: 'desc' },
    });
  }

  async createRule(dto: any) {
    return this.prisma.permissionRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        ruleDefinition: dto.ruleDefinition,
        priority: dto.priority || 0,
        isActive: dto.isActive ?? true,
        createdBy: dto.createdBy,
      },
    });
  }

  async updateRule(id: string, dto: any) {
    const rule = await this.prisma.permissionRule.findUnique({ where: { id } });

    if (!rule) {
      throw new ResourceNotFoundException('Permission Rule', id);
    }

    return this.prisma.permissionRule.update({
      where: { id },
      data: dto,
    });
  }

  async removeRule(id: string) {
    const rule = await this.prisma.permissionRule.findUnique({ where: { id } });

    if (!rule) {
      throw new ResourceNotFoundException('Permission Rule', id);
    }

    await this.prisma.permissionRule.delete({ where: { id } });
    return { message: 'Permission rule deleted successfully' };
  }
}
