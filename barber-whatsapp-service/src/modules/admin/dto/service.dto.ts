import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'Nome do serviço', example: 'Corte Fade' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Descrição dos detalhes', required: false, example: 'Corte moderno com degradê nas laterais' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Preço em Reais', minimum: 0, example: 50.00 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Duração estimada em minutos', minimum: 5, default: 30, example: 30 })
  @IsInt()
  @Min(5)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ description: 'Serviço ativo', required: false, default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateServiceDto {
  @ApiProperty({ description: 'Nome do serviço', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Descrição dos detalhes', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Preço em Reais', minimum: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Duração estimada em minutos', minimum: 5, required: false })
  @IsInt()
  @Min(5)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ description: 'Serviço ativo', required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
