import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  DeletedResourceFoundException
} from '../../common/exceptions';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) { }

  async findByProject(projectId: string) {
    return this.prisma.folder.findMany({
      where: { projectId, parentId: null, deletedAt: null },
      orderBy: { position: 'asc' },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async getTree(projectId: string) {
    const folders = await this.prisma.folder.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    return this.buildTree(folders);
  }

  async findOne(id: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        templates: {
          where: { deletedAt: null },
        },
      },
    });

    if (!folder) {
      throw new ResourceNotFoundException('Folder', id);
    }

    return folder;
  }

  async create(projectId: string, dto: CreateFolderDto, createdBy: string) {
    // Check if folder with same name exists in same project/parent
    const existing = await this.prisma.folder.findFirst({
      where: {
        projectId,
        parentId: dto.parentId || null,
        name: dto.name,
        ['_bypassSoftDelete' as any]: true,
      } as any,
    });

    if (existing) {
      if (existing.deletedAt) {
        if (dto.restoreDeleted) {
          return this.prisma.folder.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              description: dto.description,
              icon: dto.icon,
              color: dto.color,
              position: dto.position || 0,
            },
          });
        }
        throw new DeletedResourceFoundException('Folder', 'name', dto.name);
      }
      throw new ResourceAlreadyExistsException('Folder', 'name', dto.name);
    }

    let path: string;
    let depth: number;

    if (dto.parentId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new ResourceNotFoundException('Folder', dto.parentId);
      path = `${parent.path}.child_${Date.now()}`;
      depth = parent.depth + 1;
    } else {
      path = `root_${Date.now()}`;
      depth = 0;
    }

    return this.prisma.folder.create({
      data: {
        projectId,
        parentId: dto.parentId,
        name: dto.name,
        description: dto.description,
        path,
        depth,
        position: dto.position || 0,
        icon: dto.icon,
        color: dto.color,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateFolderDto) {
    const folder = await this.prisma.folder.findUnique({
      where: { id, deletedAt: null },
    });

    if (!folder) {
      throw new ResourceNotFoundException('Folder', id);
    }

    return this.prisma.folder.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        position: dto.position,
      },
    });
  }

  async remove(id: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id, deletedAt: null },
    });

    if (!folder) {
      throw new ResourceNotFoundException('Folder', id);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Get all folder IDs (this folder and all descendants)
      const foldersToDelete = await tx.folder.findMany({
        where: {
          OR: [
            { id },
            { path: { startsWith: folder.path } },
          ],
          deletedAt: null,
        },
        select: { id: true },
      });

      const folderIds = foldersToDelete.map(f => f.id);

      // Soft delete all templates in these folders
      await tx.template.updateMany({
        where: {
          folderId: { in: folderIds },
          deletedAt: null,
        },
        data: { deletedAt: now },
      });

      // Soft delete all checklist items in templates of these folders
      const templatesToDelete = await tx.template.findMany({
        where: { folderId: { in: folderIds } },
        select: { id: true },
      });

      const templateIds = templatesToDelete.map(t => t.id);
      if (templateIds.length > 0) {
        await tx.checklistItem.updateMany({
          where: {
            templateId: { in: templateIds },
            deletedAt: null,
          },
          data: { deletedAt: now },
        });
      }

      // Soft delete folder and all children
      await tx.folder.updateMany({
        where: {
          OR: [
            { id },
            { path: { startsWith: folder.path } },
          ],
        },
        data: { deletedAt: now },
      });
    });

    return { message: 'Folder and all contents deleted successfully' };
  }

  async move(id: string, newParentId: string | null) {
    const folder = await this.prisma.folder.findUnique({
      where: { id, deletedAt: null },
    });

    if (!folder) {
      throw new ResourceNotFoundException('Folder', id);
    }

    let newPath: string;
    let newDepth: number;

    if (newParentId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: newParentId } });
      if (!parent) throw new ResourceNotFoundException('Folder', newParentId);
      newPath = `${parent.path}.child_${Date.now()}`;
      newDepth = parent.depth + 1;
    } else {
      newPath = `root_${Date.now()}`;
      newDepth = 0;
    }

    return this.prisma.folder.update({
      where: { id },
      data: {
        parentId: newParentId,
        path: newPath,
        depth: newDepth,
      },
    });
  }

  private buildTree(folders: any[], parentId: string | null = null): any[] {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((folder) => ({
        ...folder,
        children: this.buildTree(folders, folder.id),
      }));
  }
}
