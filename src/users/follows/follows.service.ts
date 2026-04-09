import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Follow } from './follow.entity';
import { User } from '../user.entity';
import { FollowSerializer } from './follow.serializer';
import { t } from '../../shared/util';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  async findMyFollowings(
    followerId: number,
  ): Promise<Record<string, unknown>[]> {
    const follows = await this.followRepo.find({
      where: { followerId },
      relations: ['following'],
      order: { createdAt: 'DESC' },
    });
    return FollowSerializer.serializeMany(
      follows as unknown as Record<string, unknown>[],
      { type: 'DEFAULT' },
    );
  }

  async follow(
    followingId: number,
    followerId: number,
  ): Promise<Record<string, unknown>> {
    if (followerId === followingId) {
      throw new BadRequestException(t(this.i18n, 'follow.cannot-follow-self'));
    }

    const target = await this.userRepo.findOne({ where: { id: followingId } });
    if (!target) {
      throw new NotFoundException(
        t(this.i18n, 'follow.user-not-found', { id: followingId }),
      );
    }

    const existing = await this.followRepo.findOne({
      where: { followerId, followingId },
    });
    if (existing) {
      throw new ConflictException(t(this.i18n, 'follow.already-following'));
    }

    const follow = this.followRepo.create({ followerId, followingId });
    const saved = await this.dbSave(() => this.followRepo.save(follow));
    const full = await this.dbSave(() =>
      this.followRepo.findOne({
        where: { id: saved.id },
        relations: ['following'],
      }),
    );
    return FollowSerializer.serializeOne(
      full as unknown as Record<string, unknown>,
      { type: 'DEFAULT' },
    );
  }

  async unfollow(followingId: number, followerId: number): Promise<void> {
    const follow = await this.followRepo.findOne({
      where: { followerId, followingId },
    });
    if (!follow) {
      throw new NotFoundException(t(this.i18n, 'follow.not-following'));
    }
    try {
      await this.followRepo.remove(follow);
    } catch {
      throw new InternalServerErrorException(
        t(this.i18n, 'follow.delete-failed'),
      );
    }
  }

  private async dbSave<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        t(this.i18n, 'follow.save-failed'),
      );
    }
  }
}
