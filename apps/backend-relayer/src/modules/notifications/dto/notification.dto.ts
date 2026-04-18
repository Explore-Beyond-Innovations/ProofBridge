import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNotificationsDto {
  @ApiPropertyOptional({
    description: 'Return only unread notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' ? false : value,
  )
  unreadOnly?: boolean;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor (last notification id)' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
