import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException, InvalidTokenException } from '../../common/exceptions';
import { InvitationStatus, UserStatus } from '@prisma/client';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, invitedBy: string) {
    const token = nanoid(32);
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email.toLowerCase(),
        invitedBy,
        roleId: dto.roleId,
        projectIds: dto.projectIds || [],
        tokenHash,
        message: dto.message,
        expiresAt,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      token, // Return token only on creation
      expiresAt: invitation.expiresAt,
    };
  }

  async findAll(userId: string) {
    return this.prisma.invitation.findMany({
      where: { invitedBy: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { id } });

    if (!invitation) {
      throw new ResourceNotFoundException('Invitation', id);
    }

    await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.revoked },
    });

    return { message: 'Invitation revoked' };
  }

  private async findValidInvitation(token: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: { status: InvitationStatus.pending },
    });
    for (const inv of invitations) {
      if (await bcrypt.compare(token, inv.tokenHash)) {
        if (inv.expiresAt < new Date()) throw new InvalidTokenException();
        return inv;
      }
    }
    throw new InvalidTokenException();
  }

  async verify(token: string) {
    const invitation = await this.findValidInvitation(token);
    return {
      email: invitation.email,
      message: invitation.message,
    };
  }

  async accept(token: string, dto: any) {
    const invitation = await this.findValidInvitation(token);

    // Create user
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: UserStatus.active,
        emailVerifiedAt: new Date(),
      },
    });

    // Assign role
    if (invitation.roleId) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: invitation.roleId,
        },
      });
    }

    // Update invitation
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.accepted,
        acceptedAt: new Date(),
        acceptedBy: user.id,
      },
    });

    return { message: 'Invitation accepted', userId: user.id };
  }
}
