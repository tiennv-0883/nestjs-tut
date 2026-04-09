import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { Comment } from './comments/comment.entity';
import { Favorite } from './favorites/favorite.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';
import { FavoritesService } from './favorites/favorites.service';
import { FavoritesController } from './favorites/favorites.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Comment, Favorite]), AuthModule],
  // FavoritesController registered before ArticlesController so that
  // GET /articles/favorites takes precedence over GET /articles/:slug
  controllers: [FavoritesController, ArticlesController, CommentsController],
  providers: [ArticlesService, CommentsService, FavoritesService],
})
export class ArticlesModule {}
