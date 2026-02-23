import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../../common/guards';
import { Public, CurrentUser } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send invitation' })
  async create(@Body() dto: any, @CurrentUser() user: CurrentUserData) {
    return this.invitationsService.create(dto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get sent invitations' })
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.invitationsService.findAll(user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revoke invitation' })
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitationsService.revoke(id);
  }

  @Get(':token/verify')
  @Public()
  @ApiOperation({ summary: 'Verify invitation token' })
  async verify(@Param('token') token: string) {
    return this.invitationsService.verify(token);
  }

  @Post(':token/accept')
  @Public()
  @ApiOperation({ summary: 'Accept invitation' })
  async accept(@Param('token') token: string, @Body() dto: any) {
    return this.invitationsService.accept(token, dto);
  }
}
