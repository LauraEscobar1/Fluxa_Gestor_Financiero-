import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

/** Perfil del usuario autenticado. No hay rutas para ver o editar a otros usuarios. */
@ApiTags('users')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtiene el perfil propio' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario', type: User })
  getProfile(@CurrentUser('id') userId: number): Promise<User> {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza nombre y/o email del perfil propio' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado', type: User })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  updateProfile(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(userId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia la contraseña propia' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o la contraseña actual no coincide',
  })
  changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.usersService.changePassword(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina la cuenta propia y todos sus datos' })
  @ApiResponse({
    status: 200,
    description: 'Cuenta eliminada',
    type: MessageResponseDto,
  })
  remove(@CurrentUser('id') userId: number): Promise<MessageResponseDto> {
    return this.usersService.remove(userId);
  }
}
