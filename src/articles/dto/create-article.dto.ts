import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ArticleStatus } from '../article.entity';

export class CreateArticleDto {
  @ApiProperty({ example: 'My First Article' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'A short summary of the article.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: 'Full article content goes here...' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ example: ['nestjs', 'typescript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  @ApiPropertyOptional({ enum: ['draft', 'published'], default: 'draft' })
  @IsOptional()
  @IsIn(['draft', 'published'] as ArticleStatus[])
  status?: ArticleStatus;
}
