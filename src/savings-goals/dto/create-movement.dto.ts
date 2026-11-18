import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Max } from 'class-validator';
import { MAX_AMOUNT } from '../../transactions/dto/create-transaction.dto';

/** Body de `POST /savings-goals/:id/deposits` y `/withdrawals`. */
export class CreateMovementDto {
  @ApiProperty({
    example: 150000,
    description: 'Mayor que 0, con 2 decimales como máximo',
    maximum: MAX_AMOUNT,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto debe ser un número con 2 decimales como máximo' },
  )
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  @Max(MAX_AMOUNT, { message: `El monto no puede superar ${MAX_AMOUNT}` })
  amount: number;
}
