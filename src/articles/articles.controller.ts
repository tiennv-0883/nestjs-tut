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
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { RequestWithUser } from '../auth/jwt.guard';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @ApiOperation({ summary: 'List all published articles' })
  @Get()
  findAll() {
    return this.articlesService.findAll();
  }

  @ApiOperation({ summary: 'Get my articles (drafts + published)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@Req() req: RequestWithUser) {
    return this.articlesService.findByAuthor(req.user.sub);
  }

  @ApiOperation({ summary: 'Get a single article by slug' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateArticleDto, @Req() req: RequestWithUser) {
    return this.articlesService.create(dto, req.user.sub);
  }

  @ApiOperation({ summary: 'Update an article (author only)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArticleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.articlesService.update(id, dto, req.user.sub);
  }

  @ApiOperation({ summary: 'Publish an article (author only)' })
  @ApiResponse({ status: 200, description: 'Article published' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':slug/publish')
  publish(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    return this.articlesService.publish(slug, req.user.sub);
  }

  @ApiOperation({ summary: 'Unpublish an article back to draft (author only)' })
  @ApiResponse({ status: 200, description: 'Article unpublished' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':slug/unpublish')
  unpublish(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    return this.articlesService.unpublish(slug, req.user.sub);
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
