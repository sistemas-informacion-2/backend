import { BadRequestException, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ProbadorVarianteAdminDto } from '../dto/probador-modelo.dto.js';
import { ProbadorModelosService } from '../services/probador-modelos.service.js';

const directorioModelos = join(process.cwd(), 'uploads', 'modelos');
mkdirSync(directorioModelos, { recursive: true });

const MAXIMO_MODELO_BYTES = 100 * 1024 * 1024;

const FORMATOS_ACEPTADOS = ['.glb'];

/**
 * Seccion admin del probador virtual (CU19): listar variantes y asociar el
 * modelo 3D (.glb) de la prenda. Exporta el .glb directo desde Blender
 * (Archivo > Exportar > glTF 2.0, formato "glb") y súbelo aquí: se asocia a
 * la variante al toque, sin conversión ni proceso en segundo plano.
 */
@ApiTags('Electronico')
@Controller('electronico/probador')
export class ProbadorModelosController {
  constructor(private readonly modelosService: ProbadorModelosService) {}

  @Get('variantes')
  @RequirePermission('electronico:probador:gestionar')
  @ApiOperation({ summary: 'Variantes activas para asignar modelos 3D (CU19)' })
  listarVariantes(@Query('q') q?: string): Promise<ProbadorVarianteAdminDto[]> {
    return this.modelosService.variantes(q);
  }

  @Post('modelos/:varianteId')
  @RequirePermission('electronico:probador:gestionar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Carga un modelo 3D .glb y lo asocia a la variante' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: directorioModelos,
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAXIMO_MODELO_BYTES },
      fileFilter: (_request, file, callback) => {
        callback(null, FORMATOS_ACEPTADOS.includes(extname(file.originalname).toLowerCase()));
      },
    }),
  )
  async asociar(
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @UploadedFile() file: { filename?: string } | undefined,
    @Req() request: Request,
  ): Promise<ProbadorVarianteAdminDto> {
    if (!file?.filename) {
      throw new BadRequestException('Selecciona un modelo 3D válido en formato .glb (hasta 100 MB)');
    }
    const modelo3dUrl = `${request.protocol}://${request.get('host')}/uploads/modelos/${file.filename}`;
    return this.modelosService.asociar(varianteId, modelo3dUrl);
  }

  @Delete('modelos/:varianteId')
  @RequirePermission('electronico:probador:gestionar')
  @ApiOperation({ summary: 'Desvincula y elimina el modelo 3D de la variante' })
  quitar(@Param('varianteId', ParseIntPipe) varianteId: number): Promise<ProbadorVarianteAdminDto> {
    return this.modelosService.quitar(varianteId);
  }
}
