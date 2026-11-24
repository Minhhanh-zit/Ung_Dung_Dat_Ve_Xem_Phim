import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CashPaymentService } from './cash-payment.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashPaymentController {
  constructor(private readonly cashPaymentService: CashPaymentService) {}

  @Post(':id/admin-cash-confirm')
  @Roles('ADMIN', 'STAFF')
  confirm(@Param('id') id: string) {
    return this.cashPaymentService.confirm(id);
  }
}
