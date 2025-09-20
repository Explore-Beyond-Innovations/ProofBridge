import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdsService } from './ad.service';
import {
  CreateAdDto,
  FundAdDto,
  QueryAdsDto,
  UpdateAdDto,
  WithdrawalAdDto,
  ConfirmChainActionDto,
} from '../ads/dto/ad.dto';
import type { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';

@Controller('v1/ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: QueryAdsDto) {
    return this.ads.list(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ads.getById(id);
  }
  @Post()
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() dto: CreateAdDto) {
    return this.ads.create(req, dto);
  }

  @Post(':id/fund')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  fund(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FundAdDto,
  ) {
    return this.ads.fund(req, id, dto);
  }

  @Post(':id/withdraw')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  withdraw(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: WithdrawalAdDto,
  ) {
    return this.ads.withdraw(req, id, dto);
  }

  @Post(':id/confirm')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  confirmUpdate(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmChainActionDto,
  ) {
    return this.ads.confirmChainAction(req, id, dto);
  }

  @Patch(':id')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
    @Body() dto: UpdateAdDto,
  ) {
    return this.ads.update(req, id, dto);
  }

  @Delete(':id')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ads.close(req, id);
  }
}
