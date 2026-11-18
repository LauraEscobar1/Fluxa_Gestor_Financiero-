import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/dates';
import { MAX_AMOUNT } from '../../transactions/dto/create-transaction.dto';
import { trim } from '../../users/dto/create-user.dto';

/** Body de `POST /savings-goals`. El saldo inicial siempre es 0. */
export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'Viaje a Cartagena', maxLength: 150 })
  @Transform(trim)
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres' })
  name: string;

  @ApiProperty({
    example: 3000000,
    description: 'Monto a alcanzar. Mayor que 0, con 2 decimales como máximo',
    maximum: MAX_AMOUNT,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    {
      message:
        'El monto objetivo debe ser un número con 2 decimales como máximo',
    },
  )
  @IsPositive({ message: 'El monto objetivo debe ser mayor que 0' })
  @Max(MAX_AMOUNT, {
    message: `El monto objetivo no puede superar ${MAX_AMOUNT}`,
  })
  targetAmount: number;

  @ApiPropertyOptional({
    example: '2027-06-30',
    format: 'date',
    nullable: true,
    type: String,
    description: 'Fecha límite YYYY-MM-DD; no puede estar en el pasado',
  })
  @IsOptional()
  @IsDateOnly({
    message: 'La fecha objetivo debe ser válida y tener el formato YYYY-MM-DD',
  })
  targetDate?: string | null;
}
