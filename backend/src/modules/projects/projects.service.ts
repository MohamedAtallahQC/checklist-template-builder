import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  DeletedResourceFoundException
} from '../../common/exceptions';
import { createPaginatedResult, PaginationDto } from '../../common/dto';
import { ProjectRole } from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) { }

  async findAll(pagination: PaginationDto, userId: string, userRoles: string[]) {
    const isAdmin = userRoles.includes('admin');

    const where: any = { deletedAt: null };

    const conditions: any[] = [];

    // Non-admins can see their projects OR projects created by admins
    if (!isAdmin) {
      conditions.push({
        OR: [
          { projectUsers: { some: { userId } } },
          {
            creator: {
              userRoles: {
                some: {
                  role: {
                    name: 'admin',
                  },
                },
              },
            },
          },
        ],
      });
    }

    if (pagination.search) {
      conditions.push({
        OR: [
          { name: { contains: pagination.search, mode: 'insensitive' } },
          { description: { contains: pagination.search, mode: 'insensitive' } },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              folders: { where: { deletedAt: null } },
              templates: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return createPaginatedResult(projects, total, pagination.page || 1, pagination.limit || 20);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        folders: {
          where: { parentId: null, deletedAt: null },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            folders: { where: { deletedAt: null } },
            templates: { where: { deletedAt: null } },
            projectUsers: true,
          },
        },
      },
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', id);
    }

    return project;
  }

  async create(dto: CreateProjectDto, createdBy: string) {
    const slug = this.generateSlug(dto.name);

    // Check if slug exists (even in deleted ones)
    const existing = await this.prisma.project.findFirst({
      where: {
        slug,
        ['_bypassSoftDelete' as any]: true,
      } as any,
    });

    if (existing) {
      if (existing.deletedAt) {
        if (dto.restoreDeleted) {
          const project = await this.prisma.project.update({
            where: { id: existing.id },
            data: {
              name: dto.name,
              description: dto.description,
              icon: dto.icon,
              color: dto.color,
              deletedAt: null,
            },
          });

          // Check if user is already a member, if not add them
          const existingUser = await this.prisma.projectUser.findUnique({
            where: { projectId_userId: { projectId: project.id, userId: createdBy } }
          });

          if (!existingUser) {
            await this.prisma.projectUser.create({
              data: {
                projectId: project.id,
                userId: createdBy,
                role: ProjectRole.owner,
              },
            });
          }

          return project;
        }
        throw new DeletedResourceFoundException('Project', 'name/slug', dto.name);
      }
      throw new ResourceAlreadyExistsException('Project', 'name', dto.name);
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        slug,
        icon: dto.icon,
        color: dto.color,
        createdBy,
      },
    });

    // Add creator as owner
    await this.prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: createdBy,
        role: ProjectRole.owner,
      },
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', id);
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        isArchived: dto.isArchived,
      },
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', id);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Get all templates in this project
      const templates = await tx.template.findMany({
        where: { projectId: id, deletedAt: null },
        select: { id: true },
      });

      const templateIds = templates.map(t => t.id);

      // Soft delete all checklist items in project templates
      if (templateIds.length > 0) {
        await tx.checklistItem.updateMany({
          where: {
            templateId: { in: templateIds },
            deletedAt: null,
          },
          data: { deletedAt: now },
        });
      }

      // Soft delete all templates in this project
      await tx.template.updateMany({
        where: { projectId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      // Soft delete all folders in this project
      await tx.folder.updateMany({
        where: { projectId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      // Soft delete the project
      await tx.project.update({
        where: { id },
        data: { deletedAt: now },
      });
    });

    return { message: 'Project and all contents deleted successfully' };
  }

  async getMembers(projectId: string) {
    return this.prisma.projectUser.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    return this.prisma.projectUser.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role || ProjectRole.member,
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    await this.prisma.projectUser.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    return { message: 'Member removed successfully' };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
