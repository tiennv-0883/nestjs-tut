import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { User } from '../../src/users/user.entity';
import { Article } from '../../src/articles/article.entity';
import { Comment } from '../../src/articles/comments/comment.entity';

export interface UserWithPassword extends User {
  rawPassword: string;
}

export async function createUser(
  ds: DataSource,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<UserWithPassword> {
  const rawPassword = overrides.password ?? 'Password123!';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const email =
    overrides.email ??
    `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const name = overrides.name ?? 'Test User';

  const repo = ds.getRepository(User);
  const user = repo.create({ email, name, password: hashedPassword });
  const saved = await repo.save(user);

  return Object.assign(saved, { rawPassword });
}

export async function createArticle(
  ds: DataSource,
  authorId: number,
  overrides: Partial<{
    title: string;
    body: string;
    status: 'draft' | 'published';
  }> = {},
): Promise<Article> {
  const title = overrides.title ?? `Test Article ${Date.now()}`;
  const slug = Article.slugify(title);

  const article = ds.getRepository(Article).create({
    title,
    slug,
    body: overrides.body ?? 'Article body content.',
    description: null,
    tags: null,
    authorId,
    status: overrides.status ?? 'published',
  });

  return ds.getRepository(Article).save(article);
}

export async function createComment(
  ds: DataSource,
  articleId: number,
  authorId: number,
  body = 'Test comment body.',
): Promise<Comment> {
  const comment = ds
    .getRepository(Comment)
    .create({ body, articleId, authorId });
  return ds.getRepository(Comment).save(comment);
}

export function genToken(jwtService: JwtService, user: User): string {
  return jwtService.sign({ sub: user.id, email: user.email });
}
