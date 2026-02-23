import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException, BusinessException } from '../../common/exceptions';
import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ClickupService {
  private readonly logger = new Logger(ClickupService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('clickup.clientId') || '';
    this.clientSecret = this.configService.get<string>('clickup.clientSecret') || '';
    this.redirectUri = this.configService.get<string>('clickup.redirectUri') || '';
    this.encryptionKey = this.configService.get<string>('encryption.key') || '';
  }

  async getAuthUrl() {
    const authUrl = `https://app.clickup.com/api?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    return { url: authUrl };
  }

  async handleCallback(code: string, userId: string) {
    // TODO: Exchange code for access token using ClickUp API
    // For now, we'll simulate the response

    const accessToken = `mock_access_token_${Date.now()}`;
    const encryptedToken = this.encrypt(accessToken);

    const integration = await this.prisma.clickupIntegration.create({
      data: {
        userId,
        accessTokenEncrypted: encryptedToken,
        workspaceId: 'mock_workspace',
        workspaceName: 'Mock Workspace',
        teamId: 'mock_team',
      },
    });

    return {
      message: 'ClickUp integration connected successfully',
      integrationId: integration.id,
    };
  }

  async connectWithToken(userId: string, token: string) {
    try {
      // Validate token and get workspace info from ClickUp
      // ClickUp API expects the token directly in Authorization header (no Bearer prefix)
      const response = await fetch('https://api.clickup.com/api/v2/team', {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      this.logger.debug('ClickUp API response status', { status: response.status });

      if (!response.ok) {
        let errorMessage = 'Failed to validate ClickUp token. Please ensure it is correct.';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.err || errorData.error || errorMessage;
          this.logger.warn('ClickUp API error', { err: errorData?.err });
        } catch {
          // Response wasn't JSON
        }
        throw new BusinessException(
          'INVALID_TOKEN',
          `ClickUp API Error: ${errorMessage}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const data = JSON.parse(responseText);
      const team = data.teams?.[0]; // Get the first workspace

      if (!team) {
        throw new BusinessException(
          'NO_TEAM',
          'No workspaces found for this ClickUp account.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const encryptedToken = this.encrypt(token);

      // Remove existing active integration for this user
      await this.prisma.clickupIntegration.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      const integration = await this.prisma.clickupIntegration.create({
        data: {
          userId,
          accessTokenEncrypted: encryptedToken,
          workspaceId: team.id,
          workspaceName: team.name,
          teamId: team.id,
          isActive: true,
        },
      });

      return {
        message: 'ClickUp connected via API token',
        workspace: team.name,
      };
    } catch (err: any) {
      this.logger.error('ClickUp connection error', err?.message);
      if (err instanceof BusinessException) throw err;
      throw new BusinessException(
        'CONNECT_ERROR',
        `Could not connect to ClickUp: ${err.message || 'Please check your token.'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getStatus(userId: string) {
    const integration = await this.prisma.clickupIntegration.findFirst({
      where: { userId, isActive: true },
    });

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      workspaceName: integration.workspaceName,
      lastSyncAt: integration.lastSyncAt,
    };
  }

  async disconnect(userId: string) {
    await this.prisma.clickupIntegration.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    return { message: 'ClickUp integration disconnected' };
  }

  async getBugs(userId: string, query: any) {
    const integration = await this.getActiveIntegration(userId);

    // TODO: Fetch bugs from ClickUp API using the stored access token
    // For now, return mock data

    return {
      bugs: [
        {
          id: 'bug1',
          name: 'Sample Bug',
          status: 'open',
          assignee: query.assignedTo || 'unassigned',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    };
  }

  async createUserMapping(userId: string, dto: any) {
    const integration = await this.getActiveIntegration(userId);

    return this.prisma.clickupUserMapping.create({
      data: {
        integrationId: integration.id,
        localUserId: dto.localUserId,
        clickupUserId: dto.clickupUserId,
        clickupUsername: dto.clickupUsername,
        clickupEmail: dto.clickupEmail,
      },
    });
  }

  private async getActiveIntegration(userId: string) {
    const integration = await this.prisma.clickupIntegration.findFirst({
      where: { userId, isActive: true },
    });

    if (!integration) {
      throw new BusinessException(
        'NO_INTEGRATION',
        'ClickUp integration not connected',
        HttpStatus.BAD_REQUEST,
      );
    }

    return integration;
  }

  private encrypt(text: string): Buffer {
    // For aes-256-cbc, we need a 32-byte key (64 hex characters)
    const key = this.encryptionKey;
    const isHex = /^[0-9a-fA-F]+$/.test(key);
    const isValidLength = key.length === 64;

    if (!key || !isHex || !isValidLength) {
      throw new BusinessException('ENCRYPTION_KEY_INVALID', 'Encryption key is missing or invalid.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return Buffer.concat([iv, encrypted]);
    } catch {
      throw new BusinessException('ENCRYPTION_FAILED', 'Failed to encrypt data.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private decrypt(encrypted: Buffer): string {
    const key = this.encryptionKey;
    const isHex = /^[0-9a-fA-F]+$/.test(key);
    const isValidLength = key.length === 64;

    if (!key || !isHex || !isValidLength) {
      throw new BusinessException('ENCRYPTION_KEY_INVALID', 'Encryption key is missing or invalid.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const iv = encrypted.subarray(0, 16);
      const encryptedText = encrypted.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch {
      throw new BusinessException('ENCRYPTION_FAILED', 'Failed to decrypt data.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
