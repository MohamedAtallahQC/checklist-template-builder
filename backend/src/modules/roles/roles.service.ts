import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException, BusinessException } from '../../common/exceptions';
import { HttpStatus } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new ResourceNotFoundException('Role', id);
    }

    return role;
  }

  async create(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new ResourceNotFoundException('Role', id);
    }

    if (role.isSystem) {
      throw new BusinessException(
        'SYSTEM_ROLE',
        'Cannot modify system role',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new ResourceNotFoundException('Role', id);
    }

    if (role.isSystem) {
      throw new BusinessException(
        'SYSTEM_ROLE',
        'Cannot delete system role',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  async syncPermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });

    if (!role) {
      throw new ResourceNotFoundException('Role', roleId);
    }

    if (role.isSystem && role.name === 'admin') {
      throw new BusinessException(
        'SYSTEM_ROLE',
        'Cannot modify permissions for the system admin role',
        HttpStatus.FORBIDDEN,
      );
    }

    // Use a transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      // Remove all existing permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }

      return { message: 'Role permissions updated successfully' };
    });
  }
}
