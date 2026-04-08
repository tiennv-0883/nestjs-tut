import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { ArticleSerializer } from './article.serializer';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto, PaginatedArticles } from './dto/query-article.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { RequestWithUser } from '../auth/jwt.guard';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @ApiOperation({ summary: 'List all published articles' })
  @Get()
  async findAll(@Query() query: QueryArticleDto) {
    const result = await this.articlesService.findAll(query);
    type RawPaginated = PaginatedArticles<Record<string, unknown>>;
    const paginated = result as unknown as RawPaginated;
    return ArticleSerializer.serializePaginated(paginated, { type: 'SUMMARY' });
  }

  @ApiOperation({ summary: 'Get my articles (drafts + published)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMine(@Req() req: RequestWithUser) {
    const articles = await this.articlesService.findByAuthor(req.user.sub);
    return ArticleSerializer.serializeMany(
      articles as unknown as Record<string, unknown>[],
      { type: 'SUMMARY' },
    );
  }

  @ApiOperation({ summary: 'Get a single article by slug' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const article = await this.articlesService.findPublishedBySlug(slug);
    return ArticleSerializer.serializeOne(
      article as unknown as Record<string, unknown>,
      { type: 'DETAIL' },
    );
  }

  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateArticleDto, @Req() req: RequestWithUser) {
    const article = await this.articlesService.create(dto, req.user.sub);
    return ArticleSerializer.serializeOne(
      article as unknown as Record<string, unknown>,
      { type: 'DETAIL' },
    );
  }

  @ApiOperation({ summary: 'Update an article (author only)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArticleDto,
    @Req() req: RequestWithUser,
  ) {
    const article = await this.articlesService.update(id, dto, req.user.sub);
    return ArticleSerializer.serializeOne(
      article as unknown as Record<string, unknown>,
      { type: 'DETAIL' },
    );
  }

  @ApiOperation({ summary: 'Publish an article (author only)' })
  @ApiResponse({ status: 200, description: 'Article published' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':slug/publish')
  async publish(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const article = await this.articlesService.publish(slug, req.user.sub);
    return ArticleSerializer.serializeOne(
      article as unknown as Record<string, unknown>,
      { type: 'DETAIL' },
    );
  }

  @ApiOperation({ summary: 'Unpublish an article back to draft (author only)' })
  @ApiResponse({ status: 200, description: 'Article unpublished' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':slug/unpublish')
  async unpublish(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const article = await this.articlesService.unpublish(slug, req.user.sub);
    return ArticleSerializer.serializeOne(
      article as unknown as Record<string, unknown>,
      { type: 'DETAIL' },
    );
  }

  @ApiOperation({ summary: 'Delete an article (author only)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.articlesService.remove(id, req.user.sub);
  }
}
