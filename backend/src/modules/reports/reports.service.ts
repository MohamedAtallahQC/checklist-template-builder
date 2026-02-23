import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException } from '../../common/exceptions';
import { createPaginatedResult } from '../../common/dto';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, userId: string) {
    const where: any = { generatedBy: userId };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip: query.skip || 0,
        take: query.take || 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return createPaginatedResult(reports, total, query.page || 1, query.limit || 20);
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new ResourceNotFoundException('Report', id);
    }

    return report;
  }

  async create(dto: any, generatedBy: string) {
    const report = await this.prisma.report.create({
      data: {
        name: dto.name,
        type: dto.type,
        templateId: dto.templateId,
        projectId: dto.projectId,
        parameters: dto.parameters || {},
        format: dto.format || 'pdf',
        generatedBy,
      },
    });

    // TODO: Queue report generation job
    // For now, we'll just mark it as completed
    await this.generateReport(report.id);

    return report;
  }

  async download(id: string, res: Response) {
    const report = await this.findOne(id);

    if (!report.fileUrl || report.status !== ReportStatus.completed) {
      throw new ResourceNotFoundException('Report file', id);
    }

    // TODO: Implement actual file download from storage
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name}.pdf"`);
    res.send('Report content placeholder');
  }

  async remove(id: string) {
    const report = await this.findOne(id);

    await this.prisma.report.delete({ where: { id } });

    return { message: 'Report deleted successfully' };
  }

  private async generateReport(reportId: string) {
    // TODO: Implement actual report generation
    // This would be done in a background job using BullMQ

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.completed,
        generatedAt: new Date(),
        fileUrl: `/reports/${reportId}.pdf`,
        fileSize: BigInt(1024),
      },
    });
  }
}
