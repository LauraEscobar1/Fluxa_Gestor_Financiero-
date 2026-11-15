import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

/** Respuesta de registro y login. */
export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT para enviar en `Authorization: Bearer <token>`',
  })
  accessToken: string;

  @ApiProperty({ type: () => User })
  user: User;
}
