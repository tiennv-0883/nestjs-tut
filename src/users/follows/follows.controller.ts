import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import type { RequestWithUser } from '../../auth/jwt.guard';

@ApiTags('Follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @ApiOperation({ summary: 'List users I am following' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('followings')
  findMyFollowings(@Req() req: RequestWithUser) {
    return this.followsService.findMyFollowings(req.user.sub);
  }

  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 201, description: 'User followed' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':userId/follow')
  follow(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.followsService.follow(userId, req.user.sub);
  }

  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 204, description: 'User unfollowed' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':userId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.followsService.unfollow(userId, req.user.sub);
  }
}
