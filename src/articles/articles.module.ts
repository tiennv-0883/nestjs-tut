import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { Comment } from './comments/comment.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Comment]), AuthModule],
  controllers: [ArticlesController, CommentsController],
  providers: [ArticlesService, CommentsService],
})
export class ArticlesModule {}
