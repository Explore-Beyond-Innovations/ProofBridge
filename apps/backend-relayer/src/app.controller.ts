import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { HealthResponse } from './types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getRoot(): { message: string } {
    return { message: 'Welcome to ProofBridge' };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthResponse> {
    const health = await this.appService.health();

    if (health.checks.db === 'error') {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
