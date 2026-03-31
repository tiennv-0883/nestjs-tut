import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: number;
  email: string;
}

interface RequestWithUser extends Request {
  user: Express.User;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers.authorization;

    if (!authHeader) return false;

    const parts = authHeader.split(' ');
    const token = parts[1];

    if (!token) return false;

    if (this.authService.isTokenBlacklisted(token)) return false;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
