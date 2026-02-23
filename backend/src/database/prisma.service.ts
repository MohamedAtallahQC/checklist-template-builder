import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');

    // Soft delete middleware
    this.$use(async (params, next) => {
      // Check if the model has a deletedAt field
      const modelsWithSoftDelete = [
        'User',
        'Project',
        'Folder',
        'Template',
        'ChecklistItem',
      ];

      if (params.model && modelsWithSoftDelete.includes(params.model)) {
        // Bypass soft delete filter if requested
        if (params.args?.where?.['_bypassSoftDelete']) {
          delete params.args.where['_bypassSoftDelete'];
          return next(params);
        }

        if (params.action === 'delete') {
          // Convert delete to soft delete
          params.action = 'update';
          params.args['data'] = { deletedAt: new Date() };
        }

        if (params.action === 'deleteMany') {
          // Convert deleteMany to soft delete
          params.action = 'updateMany';
          if (params.args.data !== undefined) {
            params.args.data['deletedAt'] = new Date();
          } else {
            params.args['data'] = { deletedAt: new Date() };
          }
        }

        if (params.action === 'findUnique' || params.action === 'findFirst') {
          // Exclude soft-deleted records unless explicitly requested
          if (params.args.where && params.args.where.deletedAt === undefined) {
            params.action = 'findFirst';
            params.args.where = {
              ...params.args.where,
              deletedAt: null,
            };
          }
        }

        if (params.action === 'findMany') {
          // Exclude soft-deleted records
          if (params.args.where) {
            if (params.args.where.deletedAt === undefined) {
              params.args.where = {
                ...params.args.where,
                deletedAt: null,
              };
            }
          } else {
            params.args['where'] = { deletedAt: null };
          }
        }
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    const models = (Prisma as any).dmmf?.datamodel?.models || [];
    const tableNames = models.map((model: any) => model.dbName || model.name);

    for (const tableName of tableNames) {
      if (tableName) {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      }
    }
  }
}
