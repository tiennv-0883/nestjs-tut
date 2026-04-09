import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Follow } from './follows/follow.entity';
import { FollowsService } from './follows/follows.service';
import { FollowsController } from './follows/follows.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Follow]),
    forwardRef(() => AuthModule),
  ],
  // FollowsController registered before UsersController so that
  // GET /users/followings takes precedence over GET /users/:id
  providers: [UsersService, FollowsService],
  controllers: [FollowsController, UsersController],
  exports: [UsersService],
})
export class UsersModule {}
