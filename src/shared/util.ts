import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { I18nContext, I18nService } from 'nestjs-i18n';

export function t(
  i18n: I18nService,
  key: string,
  args?: Record<string, any>,
): string {
  return i18n.t(key, { lang: I18nContext.current()?.lang, args });
}

export async function dbSave<T>(
  fn: () => Promise<T>,
  saveFailedMsg: string,
  conflictMsg?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (
      conflictMsg &&
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code: string }).code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException(conflictMsg);
    }
    throw new InternalServerErrorException(saveFailedMsg);
  }
}
