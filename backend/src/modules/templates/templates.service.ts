import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  DeletedResourceFoundException
} from '../../common/exceptions';
import { createPaginatedResult } from '../../common/dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) { }

  /**
   * Get or create the System Templates project
   */
  private async getOrCreateSystemProject(createdBy: string): Promise<string> {
    const slug = 'system-templates';

    // Try to find the project, including deleted ones
    // We use a cast to any to pass the _bypassSoftDelete flag handled by middleware
    const systemProject = await this.prisma.project.findFirst({
      where: {
        slug,
        ['_bypassSoftDelete']: true,
      } as any,
    });

    if (systemProject) {
      // If project exists but is deleted, restore it
      if (systemProject.deletedAt) {
        await this.prisma.project.update({
          where: { id: systemProject.id },
          data: { deletedAt: null },
        });
      }
      return systemProject.id;
    }

    // Create if not exists
    try {
      const newProject = await this.prisma.project.create({
        data: {
          name: 'System Templates',
          slug,
          description: 'Container for default system templates',
          createdBy,
          isArchived: false,
        },
      });
      return newProject.id;
    } catch (error) {
      // Handle race condition: if created by another request in the meantime
      // Check for uniqueness constraint violation (P2002)
      if ((error as any).code === 'P2002') {
        const existing = await this.prisma.project.findUnique({
          where: { slug },
        });
        if (existing) return existing.id;
      }
      throw error;
    }
  }

  async findAll(query: any) {
    const where: any = { deletedAt: null };

    // Only show actual templates, not instances (unless explicitly requested)
    if (!query.includeInstances) {
      where.isTemplate = true;
    }

    if (query.projectId) {
      // If specific projectId is provided, filter by it
      where.projectId = query.projectId;
      // Also filter by folderId if provided
      if (query.folderId) {
        where.folderId = query.folderId;
      }
    } else if (query.folderId) {
      // If folderId is provided, filter by folder (project-specific query)
      where.folderId = query.folderId;
    } else if (!query.showAll) {
      // If no projectId/folderId and not explicitly requesting all, only show system templates
      const systemProject = await this.prisma.project.findUnique({
        where: { slug: 'system-templates' },
      });
      if (!systemProject) {
        // No system-templates project exists — return empty result immediately
        return createPaginatedResult([], 0, query.page || 1, query.limit || 20);
      }
      where.projectId = systemProject.id;
    }

    if (query.search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        skip: query.skip || 0,
        take: query.take || 20,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        include: {
          templateType: true,
          project: {
            select: { id: true, name: true, slug: true },
          },
          folder: {
            select: { id: true, name: true },
          },
          _count: {
            select: { checklistItems: true },
          },
        },
      }),
      this.prisma.template.count({ where }),
    ]);

    return createPaginatedResult(templates, total, query.page || 1, query.limit || 20);
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id, deletedAt: null },
      include: {
        templateType: true,
        checklistItems: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!template) {
      throw new ResourceNotFoundException('Template', id);
    }

    return template;
  }

  async create(dto: CreateTemplateDto, createdBy: string) {
    // Validate required fields
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Template name is required');
    }
    if (!dto.templateTypeId || dto.templateTypeId.trim() === '') {
      throw new BadRequestException('Template type is required');
    }

    // Verify templateTypeId exists
    const templateType = await this.prisma.templateType.findUnique({
      where: { id: dto.templateTypeId },
    });
    if (!templateType) {
      throw new BadRequestException('Invalid template type');
    }

    // If no projectId provided, use System Templates project (auto-create if needed)
    let projectId = dto.projectId;
    if (!projectId) {
      projectId = await this.getOrCreateSystemProject(createdBy);
    }

    // Check if template with same name exists in same project/folder (including soft deleted)
    const existing = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "templates"
      WHERE "project_id" = ${projectId}::text
      AND ("folder_id" = ${dto.folderId || null}::text OR ("folder_id" IS NULL AND ${dto.folderId || null}::text IS NULL))
      AND "name" = ${dto.name}::text
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      const existingTemplate = existing[0];
      if (existingTemplate.deletedAt) {
        if (dto.restoreDeleted) {
          return this.prisma.template.update({
            where: { id: existingTemplate.id },
            data: {
              deletedAt: null,
              description: dto.description,
              templateTypeId: dto.templateTypeId,
              settings: dto.settings || {},
              columnConfig: dto.columnConfig || [],
            },
          });
        }
        throw new DeletedResourceFoundException('Template', 'name', dto.name);
      }
      throw new ResourceAlreadyExistsException('Template', 'name', dto.name);
    }

    return this.prisma.template.create({
      data: {
        projectId,
        folderId: dto.folderId,
        templateTypeId: dto.templateTypeId,
        name: dto.name,
        description: dto.description,
        settings: dto.settings || {},
        columnConfig: dto.columnConfig || [],
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new ResourceNotFoundException('Template', id);
    }

    return this.prisma.template.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        settings: dto.settings,
        columnConfig: dto.columnConfig,
        isLocked: dto.isLocked,
      },
    });
  }

  async remove(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new ResourceNotFoundException('Template', id);
    }

    await this.prisma.template.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Template deleted successfully' };
  }

  async instantiate(id: string, dto: InstantiateTemplateDto, createdBy: string) {
    const template = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Create new template as instance - use dto.projectId if provided, otherwise use template's projectId
      const instance = await tx.template.create({
        data: {
          projectId: dto.projectId || template.projectId,
          folderId: dto.folderId || null,
          templateTypeId: template.templateTypeId,
          name: dto.name || `${template.name} - Instance`,
          description: template.description,
          settings: template.settings as any,
          columnConfig: template.columnConfig as any,
          isTemplate: false,
          parentTemplateId: template.id,
          createdBy,
        },
      });

      // Copy checklist items in bulk
      if (template.checklistItems.length > 0) {
        await tx.checklistItem.createMany({
          data: template.checklistItems.map((item) => ({
            templateId: instance.id,
            position: item.position,
            content: item.content as any,
            createdBy,
          })),
        });
      }

      return instance;
    });
  }

  async duplicate(id: string, createdBy: string) {
    const template = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Create new template as copy
      const copy = await tx.template.create({
        data: {
          projectId: template.projectId,
          folderId: template.folderId,
          templateTypeId: template.templateTypeId,
          name: `Copy of ${template.name}`,
          description: template.description,
          settings: template.settings as any,
          columnConfig: template.columnConfig as any,
          isTemplate: true,
          createdBy,
        },
      });

      // Copy checklist items in bulk
      const items = await tx.checklistItem.findMany({
        where: { templateId: id, deletedAt: null },
        orderBy: { position: 'asc' },
      });

      if (items.length > 0) {
        await tx.checklistItem.createMany({
          data: items.map((item) => ({
            templateId: copy.id,
            position: item.position,
            content: item.content as any,
            createdBy,
          })),
        });
      }

      return copy;
    });
  }

  async getItems(templateId: string) {
    return this.prisma.checklistItem.findMany({
      where: { templateId, deletedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  async createItem(
    templateId: string,
    dto: { parentId?: string; position?: number; content: unknown },
    createdBy: string,
  ) {
    return this.prisma.checklistItem.create({
      data: {
        templateId,
        parentId: dto.parentId,
        position: dto.position ?? 0,
        content: dto.content as any,
        createdBy,
      },
    });
  }

  /**
   * Reorder templates by updating their positions
   * @param orderedIds Array of template IDs in the new order
   */
  async reorder(orderedIds: string[]) {
    // Validate that all IDs exist
    const templates = await this.prisma.template.findMany({
      where: {
        id: { in: orderedIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    const existingIds = new Set(templates.map(t => t.id));
    const invalidIds = orderedIds.filter(id => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid template IDs: ${invalidIds.join(', ')}`);
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.template.update({ where: { id }, data: { position: index } }),
      ),
    );

    return { message: 'Templates reordered successfully' };
  }
}
