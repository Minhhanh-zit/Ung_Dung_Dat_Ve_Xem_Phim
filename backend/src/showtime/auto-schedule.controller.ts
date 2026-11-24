import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AutoScheduleService } from './auto-schedule.service';

@Controller('showtimes/admin/auto-schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AutoScheduleController {
  constructor(private readonly service:AutoScheduleService){}
  @Get('options') options(){return this.service.options();}
  @Post('preview') preview(@Body() body:unknown){return this.service.preview(body);}
  @Post('apply') apply(@Body('config') config:unknown,@Body('digest') digest:unknown,@CurrentUser() user:CurrentUserPayload){return this.service.apply(config,digest,user.userId);}
}
