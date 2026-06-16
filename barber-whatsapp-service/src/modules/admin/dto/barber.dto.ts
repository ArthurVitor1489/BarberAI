import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WorkingHourDto {
  @ApiProperty({ description: 'Dia da semana (0 = Domingo, 1 = Segunda, etc.)', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Horário de início (Formato HH:MM)', example: '09:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime deve estar no formato HH:MM' })
  startTime: string;

  @ApiProperty({ description: 'Horário de término (Formato HH:MM)', example: '18:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime deve estar no formato HH:MM' })
  endTime: string;
}

export class CreateBarberDto {
  @ApiProperty({ description: 'Nome completo do barbeiro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Especialidade', example: 'Degradê, barba e terapia capilar' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ description: 'URL da foto de perfil', required: false })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({ description: 'Disponibilidade ativa', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({ description: 'Escala de horários de funcionamento', type: [WorkingHourDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];
}

export class UpdateBarberDto {
  @ApiProperty({ description: 'Nome completo do barbeiro', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Especialidade', required: false })
  @IsString()
  @IsOptional()
  specialty?: string;

  @ApiProperty({ description: 'URL da foto de perfil', required: false })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({ description: 'Disponibilidade ativa', required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
