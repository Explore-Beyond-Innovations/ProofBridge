import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  RefreshDto,
  LoginDTO,
  LinkWalletDto,
  ChallengeDTO,
  ChallengeResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  LinkWalletResponseDto,
} from './dto/auth.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';

@ApiTags('Auth')
@Controller('/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Generates a unique challenge nonce for the provided address',
    type: ChallengeResponseDto,
  })
  async challenge(@Body() dto: ChallengeDTO) {
    return this.auth.challenge(dto.address, dto.chainKind);
  }

  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Verifies the signed message and returns access and refresh tokens',
    type: LoginResponseDto,
  })
  async login(@Body() dto: LoginDTO) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refreshes the access token using a valid refresh token',

    type: RefreshResponseDto,
  })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh);
  }

  @ApiBearerAuth()
  @Post('link')
  @UseGuards(UserJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Attaches an additional wallet (different chain) to the authenticated user',
    type: LinkWalletResponseDto,
  })
  async link(@Req() req: Request, @Body() dto: LinkWalletDto) {
    const reqUser = req.user;
    if (!reqUser) throw new ForbiddenException('Unauthorized');
    return this.auth.linkWallet(reqUser.sub, dto);
  }
}
