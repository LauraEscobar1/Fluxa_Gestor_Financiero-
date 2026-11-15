import { ApiProperty } from '@nestjs/swagger';

/** Respuesta estándar de los endpoints que solo confirman una acción (p. ej. `DELETE`). */
export class MessageResponseDto {
  @ApiProperty({ example: 'Operación realizada correctamente' })
  message: string;
}
