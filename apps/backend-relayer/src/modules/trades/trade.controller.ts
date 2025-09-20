import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TradesService } from './trade.service';
import {
  ConfirmChainActionDto,
  ConfirmTradeDto,
  CreateTradeDto,
  QueryTradesDto,
} from './dto/trade.dto';
import type { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';

@Controller('v1/trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: QueryTradesDto) {
    return this.trades.list(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.trades.getById(id);
  }

  @Post(':id/lock')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  lock(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.trades.lockTrade(req, id);
  }

  @Post()
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateTradeDto) {
    return this.trades.create(req, dto);
  }

  @Post(':id/authorize')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  confirm(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmTradeDto,
  ) {
    return this.trades.authorize(req, id, dto);
  }

  @Post(':id/confirm')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.OK)
  confirmChainAction(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmChainActionDto,
  ) {
    return this.trades.confirmChainAction(req, id, dto);
  }
}
