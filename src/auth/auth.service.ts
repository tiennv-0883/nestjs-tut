import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { t } from '../shared/util';

@Injectable()
export class AuthService {
  private readonly blacklist = new Set<string>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private i18n: I18nService,
  ) {}

  isTokenBlacklisted(token: string): boolean {
    return this.blacklist.has(token);
  }

  logout(authorizationHeader: string | undefined): { message: string } {
    const token = authorizationHeader?.split(' ')[1] ?? '';
    this.blacklist.add(token);
    return { message: t(this.i18n, 'auth.logged-out') };
  }

  async signup(email: string, password: string, name?: string) {
    await this.checkUserExistingAndThrow(email);

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      return await this.usersService.create({
        email,
        password: hashedPassword,
        name,
      });
    } catch {
      throw new InternalServerErrorException(
        t(this.i18n, 'auth.create-user-failed'),
      );
    }
  }

  async login(email: string, password: string) {
    const user = await this.findUserOrThrow(email);
    await this.checkPasswordOrThrow(password, user.password);

    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }

  private throwUnauthorized(): never {
    throw new UnauthorizedException();
  }

  private async checkUserExistingAndThrow(email: string): Promise<void> {
    const existing = await this.usersService.findByEmail(email);
    if (existing)
      throw new ConflictException(t(this.i18n, 'auth.email-exists'));
  }

  private async findUserOrThrow(email: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) this.throwUnauthorized();
    return user;
  }

  private async checkPasswordOrThrow(
    password: string,
    hashedPassword: string,
  ): Promise<void> {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) this.throwUnauthorized();
  }
}
