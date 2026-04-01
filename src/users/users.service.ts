import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findByEmailWithPassword(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  findAll() {
    return this.userRepo.find();
  }

  async create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.executeOrThrow(
      () => this.userRepo.save(user),
      'Failed to create user',
    );
  }

  async update(id: number, data: Partial<User>) {
    await this.executeOrThrow(
      () => this.userRepo.update(id, data),
      'Failed to update user',
    );
    return this.findById(id);
  }

  private async executeOrThrow<T>(
    fn: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch {
      throw new InternalServerErrorException(errorMessage);
    }
  }
}
