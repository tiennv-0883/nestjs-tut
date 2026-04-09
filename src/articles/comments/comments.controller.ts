import {
  Body,
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
import { CommentsService } from './comments.service';
import { CommentSerializer } from './comment.serializer';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import type { RequestWithUser } from '../../auth/jwt.guard';

@ApiTags('Comments')
@Controller('articles/:articleId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: 'List all comments for an article' })
  @Get()
  async findAll(@Param('articleId', ParseIntPipe) articleId: number) {
    const comments = await this.commentsService.findAllByArticle(articleId);
    return CommentSerializer.serializeMany(
      comments as unknown as Record<string, unknown>[],
      { type: 'DEFAULT' },
    );
  }

  @ApiOperation({ summary: 'Add a comment to an article' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Body() dto: CreateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    const comment = await this.commentsService.create(
      articleId,
      dto,
      req.user.sub,
    );
    return CommentSerializer.serializeOne(
      comment as unknown as Record<string, unknown>,
      { type: 'DEFAULT' },
    );
  }

  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.remove(id, articleId, req.user.sub);
  }
}
