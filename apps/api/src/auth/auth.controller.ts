import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActiveUser } from './decorators/active-user.decorator';
import { ActiveUserData } from './types/active-user-data';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { limit: 20, ttl: 60 } })
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, {
      ip: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@ActiveUser() user: ActiveUserData) {
    return user;
  }
}
