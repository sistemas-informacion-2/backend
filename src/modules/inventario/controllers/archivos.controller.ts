import { BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';

const uploadDirectory = join(process.cwd(), 'uploads');
mkdirSync(uploadDirectory, { recursive: true });

@ApiTags('Inventario')
@Controller('inventario/archivos')
export class ArchivosController {
  @Post('imagenes')
  @RequireAnyPermission('inventario:categorias:gestionar', 'inventario:productos:gestionar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Carga una imagen para categorias o productos' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDirectory,
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype));
      },
    }),
  )
  cargarImagen(@UploadedFile() file: { filename?: string } | undefined, @Req() request: Request) {
    if (!file?.filename) throw new BadRequestException('Selecciona una imagen valida de tipo JPG, PNG, WEBP o GIF');
    return { url: `${request.protocol}://${request.get('host')}/uploads/${file.filename}` };
  }
}