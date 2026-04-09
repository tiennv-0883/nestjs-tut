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
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import type { RequestWithUser } from '../../auth/jwt.guard';

@ApiTags('Favorites')
@Controller('articles')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @ApiOperation({ summary: 'List my favorited articles' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  findMine(@Req() req: RequestWithUser) {
    return this.favoritesService.findMyFavorites(req.user.sub);
  }

  @ApiOperation({ summary: 'Favorite an article' })
  @ApiResponse({ status: 201, description: 'Article favorited' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':articleId/favorite')
  favorite(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.favoritesService.favorite(articleId, req.user.sub);
  }

  @ApiOperation({ summary: 'Unfavorite an article' })
  @ApiResponse({ status: 204, description: 'Article unfavorited' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':articleId/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfavorite(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.favoritesService.unfavorite(articleId, req.user.sub);
  }
}
