import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article]), forwardRef(() => AuthModule)],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
