import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great article!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
