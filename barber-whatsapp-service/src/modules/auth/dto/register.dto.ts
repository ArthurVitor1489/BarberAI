import { IsString, IsEmail, IsNotEmpty, MinLength, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'E-mail do usuário', example: 'dono@premium.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha (mínimo de 6 caracteres)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Nível de acesso', enum: ['OWNER', 'MANAGER', 'BARBER'] })
  @IsString()
  @IsEnum(['OWNER', 'MANAGER', 'BARBER'])
  role: string;

  @ApiProperty({ description: 'ID da barbearia (tenant UUID)' })
  @IsUUID()
  barbershopId: string;
}
