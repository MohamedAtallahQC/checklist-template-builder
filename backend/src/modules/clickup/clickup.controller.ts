import { Controller, Get, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClickupService } from './clickup.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('integrations')
@Controller('integrations/clickup')
export class ClickupController {
  constructor(private clickupService: ClickupService) { }

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get ClickUp OAuth URL' })
  async getAuthUrl() {
    return this.clickupService.getAuthUrl();
  }

  @Post('callback')
  @Public()
  @ApiOperation({ summary: 'Handle ClickUp OAuth callback' })
  async handleCallback(@Body() dto: any) {
    return this.clickupService.handleCallback(dto.code, dto.userId);
  }

  @Post('token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Connect ClickUp with Personal API Token' })
  async connectWithToken(@Body() dto: { token: string }, @CurrentUser() user: CurrentUserData) {
    return this.clickupService.connectWithToken(user.id, dto.token);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get integration status' })
  async getStatus(@CurrentUser() user: CurrentUserData) {
    return this.clickupService.getStatus(user.id);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disconnect ClickUp integration' })
  async disconnect(@CurrentUser() user: CurrentUserData) {
    return this.clickupService.disconnect(user.id);
  }

  @Get('bugs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get bugs from ClickUp filtered by user' })
  async getBugs(@Query() query: any, @CurrentUser() user: CurrentUserData) {
    return this.clickupService.getBugs(user.id, query);
  }

  @Post('user-mappings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create user mapping' })
  async createUserMapping(@Body() dto: any, @CurrentUser() user: CurrentUserData) {
    return this.clickupService.createUserMapping(user.id, dto);
  }
}
