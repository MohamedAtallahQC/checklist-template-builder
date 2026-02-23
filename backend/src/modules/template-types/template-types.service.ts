import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  DeletedResourceFoundException
} from '../../common/exceptions';
import { CreateTemplateTypeDto } from './dto/create-template-type.dto';
import { UpdateTemplateTypeDto } from './dto/update-template-type.dto';

@Injectable()
export class TemplateTypesService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.templateType.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async findOne(id: string) {
    const templateType = await this.prisma.templateType.findUnique({
      where: { id },
    });

    if (!templateType) {
      throw new ResourceNotFoundException('Template Type', id);
    }

    return templateType;
  }

  async create(dto: CreateTemplateTypeDto, createdBy: string) {
    // Check if exists
    const existing = await this.prisma.templateType.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      if (!existing.isActive) {
        if (dto.restoreDeleted) {
          return this.prisma.templateType.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              displayName: dto.displayName,
              description: dto.description,
            },
          });
        }
        throw new DeletedResourceFoundException('Template Type', 'name', dto.name);
      }
      throw new ResourceAlreadyExistsException('Template Type', 'name', dto.name);
    }

    return this.prisma.templateType.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        schema: dto.schema || {},
        defaultColumns: dto.defaultColumns || [],
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateTypeDto) {
    const templateType = await this.prisma.templateType.findUnique({
      where: { id },
    });

    if (!templateType) {
      throw new ResourceNotFoundException('Template Type', id);
    }

    // System check intentionally removed; all template types are fully editable

    return this.prisma.templateType.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        schema: dto.schema,
        defaultColumns: dto.defaultColumns,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    const templateType = await this.prisma.templateType.findUnique({
      where: { id },
    });

    if (!templateType) {
      throw new ResourceNotFoundException('Template Type', id);
    }

    // System check intentionally removed; all template types are fully editable

    await this.prisma.templateType.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Template type deleted successfully' };
  }
}
