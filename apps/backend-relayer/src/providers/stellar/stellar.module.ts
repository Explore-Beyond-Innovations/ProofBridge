import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';

@Module({
  imports: [],
  providers: [StellarService],
  controllers: [],
  exports: [StellarService],
})
export class StellarModule {}
