import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'E-mail cadastrado', example: 'dono@premium.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
