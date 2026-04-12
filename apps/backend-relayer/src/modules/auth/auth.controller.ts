import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RefreshDto,
  LoginDTO,
  ChallengeDTO,
  ChallengeResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
} from './dto/auth.dto';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

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
}
