import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { createPaginatedResult } from '../../common/dto';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip || 0,
        take: query.take || 50,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(logs, total, query.page || 1, query.limit || 50);
  }

  async export(query: any, res: Response) {
    const { data } = await this.findAll({ ...query, limit: 10000 });

    const csv = this.convertToCSV(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  }

  async getStats(query: any) {
    const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const [byAction, byResource, totalCount] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        _count: true,
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      totalCount,
      byAction: byAction.map((item) => ({
        action: item.action,
        count: item._count,
      })),
      byResource: byResource.map((item) => ({
        resource: item.resourceType,
        count: item._count,
      })),
    };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = ['ID', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'Timestamp'];
    const rows = data.map((log) => [
      log.id,
      log.actor?.email || log.actorEmail || 'System',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
