import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './database/redis.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FoldersModule } from './modules/folders/folders.module';
import { TemplateTypesModule } from './modules/template-types/template-types.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ChecklistItemsModule } from './modules/checklist-items/checklist-items.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { ClickupModule } from './modules/clickup/clickup.module';
import { HealthModule } from './modules/health/health.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    DatabaseModule,
    RedisModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    InvitationsModule,
    ProjectsModule,
    FoldersModule,
    TemplateTypesModule,
    TemplatesModule,
    ChecklistItemsModule,
    ReportsModule,
    AuditModule,
    ClickupModule,
    HealthModule,
  ],
})
export class AppModule { }
