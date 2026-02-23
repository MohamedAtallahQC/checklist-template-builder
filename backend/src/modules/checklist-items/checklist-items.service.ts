import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException } from '../../common/exceptions';
import { ChecklistItemStatus } from '@prisma/client';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { AddResponseDto } from './dto/add-response.dto';

@Injectable()
export class ChecklistItemsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id, deletedAt: null },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        itemResponses: {
          orderBy: { respondedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!item) {
      throw new ResourceNotFoundException('Checklist Item', id);
    }

    return item;
  }

  async update(id: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new ResourceNotFoundException('Checklist Item', id);
    }

    return this.prisma.checklistItem.update({
      where: { id },
      data: {
        content: dto.content,
        position: dto.position,
        notes: dto.notes,
        dueDate: dto.dueDate,
        assignedTo: dto.assignedTo,
      },
    });
  }

  async remove(id: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new ResourceNotFoundException('Checklist Item', id);
    }

    await this.prisma.checklistItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Item deleted successfully' };
  }

  async updateStatus(id: string, newStatus: string, userId: string, comment?: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new ResourceNotFoundException('Checklist Item', id);
    }

    const previousStatus = item.status;

    // Update item status
    const updatedItem = await this.prisma.checklistItem.update({
      where: { id },
      data: {
        status: newStatus as ChecklistItemStatus,
        completedAt: ['passed', 'failed'].includes(newStatus) ? new Date() : null,
        completedBy: ['passed', 'failed'].includes(newStatus) ? userId : null,
      },
    });

    // Create response record
    await this.prisma.itemResponse.create({
      data: {
        checklistItemId: id,
        previousStatus,
        newStatus: newStatus as ChecklistItemStatus,
        comment,
        respondedBy: userId,
      },
    });

    return updatedItem;
  }

  async addResponse(id: string, dto: AddResponseDto, userId: string) {
    return this.prisma.itemResponse.create({
      data: {
        checklistItemId: id,
        previousStatus: dto.previousStatus,
        newStatus: dto.newStatus,
        comment: dto.comment,
        evidence: dto.evidence || [],
        respondedBy: userId,
      },
    });
  }

  async getHistory(id: string) {
    return this.prisma.itemResponse.findMany({
      where: { checklistItemId: id },
      orderBy: { respondedAt: 'desc' },
      include: {
        responder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
