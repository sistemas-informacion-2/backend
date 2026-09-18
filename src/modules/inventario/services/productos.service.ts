import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Producto } from '../entities/producto.entity.js';
import { ImagenProducto } from '../entities/imagen-producto.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import { ProductoRepository } from '../repositories/producto.repository.js';
import { ImagenProductoRepository } from '../repositories/imagen-producto.repository.js';
import { VarianteProductoRepository } from '../repositories/variante-producto.repository.js';
import { CategoriaRepository } from '../repositories/categoria.repository.js';
import { toProductoResponseDto } from '../mappers/producto.mapper.js';
import type { CrearProductoDto } from '../dto/crear-producto.dto.js';
import type { ActualizarProductoDto } from '../dto/actualizar-producto.dto.js';
import type { CrearImagenProductoDto } from '../dto/crear-imagen-producto.dto.js';
import type { ActualizarImagenProductoDto } from '../dto/actualizar-imagen-producto.dto.js';
import type { CrearVarianteProductoDto } from '../dto/crear-variante-producto.dto.js';
import type { ActualizarVarianteProductoDto } from '../dto/actualizar-variante-producto.dto.js';
import type { ProductosQueryDto } from '../dto/productos-query.dto.js';
import type { ProductosPublicoQueryDto } from '../dto/productos-publico-query.dto.js';
import type { ProductoResponseDto, ProductosPaginatedResponseDto } from '../dto/producto-response.dto.js';

@Injectable()
export class ProductosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productoRepo: ProductoRepository,
    private readonly imagenRepo: ImagenProductoRepository,
    private readonly varianteRepo: VarianteProductoRepository,
    private readonly categoriaRepo: CategoriaRepository,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async listarPublico(query: ProductosPublicoQueryDto): Promise<ProductoResponseDto[]> {
    const productos = await this.productoRepo.findActivos(query);
    return productos.map(toProductoResponseDto);
  }

  async listar(query: ProductosQueryDto): Promise<ProductosPaginatedResponseDto> {
    const { items, total } = await this.productoRepo.findPage(query);
    return {
      items: items.map(toProductoResponseDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async obtener(id: number): Promise<ProductoResponseDto> {
    const producto = await this.productoRepo.findByIdConDetalle(id);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return toProductoResponseDto(producto);
  }

  async crear(dto: CrearProductoDto): Promise<ProductoResponseDto> {
    await this.validarCategoria(dto.idCategoria);
    if (dto.idSucursal !== undefined) await this.validarSucursal(dto.idSucursal);
    await this.validarSkusUnicos(dto.variantes.map((variante) => variante.sku));

    const idProducto = await this.dataSource.transaction(async (manager) => {
      const producto = this.productoRepo.create(
        {
          idCategoria: dto.idCategoria,
          idSucursal: dto.idSucursal ?? null,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          precio: dto.precio,
          activo: true,
        },
        manager,
      );
      await this.productoRepo.save(producto, manager);

      const imagenesDto = dto.imagenes ?? [];
      if (imagenesDto.length > 0) {
        this.normalizarPrincipal(imagenesDto);
        const imagenes = imagenesDto.map((img, index) =>
          this.imagenRepo.create(
            {
              idProducto: producto.id,
              url: img.url,
              esPrincipal: img.esPrincipal ?? false,
              orden: img.orden ?? index + 1,
            },
            manager,
          ),
        );
        await this.imagenRepo.saveMuchas(imagenes, manager);
      }

      const variantes = dto.variantes.map((variante) =>
        this.varianteRepo.create(
          {
            idProducto: producto.id,
            sku: variante.sku.trim(),
            talla: variante.talla.trim(),
            color: variante.color.trim(),
            corte: variante.corte.trim(),
            codigoHexColor: variante.codigoHexColor?.trim() || null,
            modelo3dUrl: variante.modelo3dUrl?.trim() || null,
            activo: true,
          },
          manager,
        ),
      );
      await this.varianteRepo.saveMuchas(variantes, manager);

      return producto.id;
    });

    return this.obtener(idProducto);
  }

  async actualizar(id: number, dto: ActualizarProductoDto): Promise<ProductoResponseDto> {
    const producto = await this.productoRepo.findById(id);
    if (!producto) throw new NotFoundException('Producto no encontrado');

    if (dto.idCategoria !== undefined) await this.validarCategoria(dto.idCategoria);
    if (dto.idSucursal !== undefined && dto.idSucursal !== null) await this.validarSucursal(dto.idSucursal);

    Object.assign(producto, {
      ...(dto.idCategoria !== undefined && { idCategoria: dto.idCategoria }),
      ...(dto.idSucursal !== undefined && { idSucursal: dto.idSucursal }),
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      ...(dto.descripcion !== undefined && { descripcion: dto.descripcion?.trim() || null }),
      ...(dto.precio !== undefined && { precio: dto.precio }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.productoRepo.save(producto);

    return this.obtener(id);
  }

  async eliminar(id: number): Promise<void> {
    const producto = await this.productoRepo.findById(id);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    producto.activo = false;
    await this.productoRepo.save(producto);
  }

  async agregarVariante(idProducto: number, dto: CrearVarianteProductoDto): Promise<ProductoResponseDto> {
    await this.obtenerProductoOFallar(idProducto);
    await this.validarSkusUnicos([dto.sku]);

    const variante = this.varianteRepo.create({
      idProducto,
      sku: dto.sku.trim(),
      talla: dto.talla.trim(),
      color: dto.color.trim(),
      corte: dto.corte.trim(),
      codigoHexColor: dto.codigoHexColor?.trim() || null,
      modelo3dUrl: dto.modelo3dUrl?.trim() || null,
      activo: true,
    });
    await this.varianteRepo.save(variante);

    return this.obtener(idProducto);
  }

  async actualizarVariante(
    idProducto: number,
    idVariante: number,
    dto: ActualizarVarianteProductoDto,
  ): Promise<ProductoResponseDto> {
    const variante = await this.obtenerVarianteOFallar(idProducto, idVariante);

    if (dto.sku !== undefined && dto.sku.trim() !== variante.sku) {
      await this.validarSkusUnicos([dto.sku]);
    }

    Object.assign(variante, {
      ...(dto.sku !== undefined && { sku: dto.sku.trim() }),
      ...(dto.talla !== undefined && { talla: dto.talla.trim() }),
      ...(dto.color !== undefined && { color: dto.color.trim() }),
      ...(dto.corte !== undefined && { corte: dto.corte.trim() }),
      ...(dto.codigoHexColor !== undefined && { codigoHexColor: dto.codigoHexColor?.trim() || null }),
      ...(dto.modelo3dUrl !== undefined && { modelo3dUrl: dto.modelo3dUrl?.trim() || null }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });
    await this.varianteRepo.save(variante);

    return this.obtener(idProducto);
  }

  async eliminarVariante(idProducto: number, idVariante: number): Promise<ProductoResponseDto> {
    const variante = await this.obtenerVarianteOFallar(idProducto, idVariante);
    variante.activo = false;
    await this.varianteRepo.save(variante);
    return this.obtener(idProducto);
  }

  async agregarImagen(idProducto: number, dto: CrearImagenProductoDto): Promise<ProductoResponseDto> {
    await this.obtenerProductoOFallar(idProducto);

    if (dto.esPrincipal) await this.imagenRepo.desmarcarPrincipales(idProducto);
    const orden = dto.orden ?? (await this.imagenRepo.contarPorProducto(idProducto)) + 1;

    const imagen = this.imagenRepo.create({
      idProducto,
      url: dto.url,
      esPrincipal: dto.esPrincipal ?? false,
      orden,
    });
    await this.imagenRepo.save(imagen);

    return this.obtener(idProducto);
  }

  async actualizarImagen(
    idProducto: number,
    idImagen: number,
    dto: ActualizarImagenProductoDto,
  ): Promise<ProductoResponseDto> {
    const imagen = await this.obtenerImagenOFallar(idProducto, idImagen);

    if (dto.esPrincipal === true) await this.imagenRepo.desmarcarPrincipales(idProducto);

    Object.assign(imagen, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.esPrincipal !== undefined && { esPrincipal: dto.esPrincipal }),
      ...(dto.orden !== undefined && { orden: dto.orden }),
    });
    await this.imagenRepo.save(imagen);

    return this.obtener(idProducto);
  }

  async eliminarImagen(idProducto: number, idImagen: number): Promise<ProductoResponseDto> {
    const imagen = await this.obtenerImagenOFallar(idProducto, idImagen);
    await this.imagenRepo.remove(imagen);
    return this.obtener(idProducto);
  }

  private normalizarPrincipal(imagenes: CrearImagenProductoDto[]): void {
    const tienePrincipal = imagenes.some((imagen) => imagen.esPrincipal);
    if (!tienePrincipal) {
      imagenes[0].esPrincipal = true;
      return;
    }
    let yaMarcada = false;
    for (const imagen of imagenes) {
      if (imagen.esPrincipal && !yaMarcada) {
        yaMarcada = true;
      } else {
        imagen.esPrincipal = false;
      }
    }
  }

  private async validarCategoria(idCategoria: number): Promise<void> {
    const categoria = await this.categoriaRepo.findById(idCategoria);
    if (!categoria) throw new BadRequestException('La categoría indicada no existe');
  }

  private async validarSucursal(idSucursal: number): Promise<void> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: idSucursal } });
    if (!sucursal) throw new BadRequestException('La sucursal indicada no existe');
  }

  private async validarSkusUnicos(skus: string[]): Promise<void> {
    const normalizados = skus.map((sku) => sku.trim());
    const unicos = new Set(normalizados.map((sku) => sku.toLowerCase()));
    if (unicos.size !== normalizados.length) {
      throw new BadRequestException('Los SKU de las variantes no pueden repetirse');
    }

    const existentes = await this.varianteRepo.findBySkus(normalizados);
    if (existentes.length > 0) {
      throw new ConflictException(`El/los SKU ya están en uso: ${existentes.map((v) => v.sku).join(', ')}`);
    }
  }

  private async obtenerProductoOFallar(idProducto: number): Promise<Producto> {
    const producto = await this.productoRepo.findById(idProducto);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  private async obtenerVarianteOFallar(idProducto: number, idVariante: number): Promise<VarianteProducto> {
    const variante = await this.varianteRepo.findById(idVariante);
    if (!variante || variante.idProducto !== idProducto) {
      throw new NotFoundException('Variante no encontrada');
    }
    return variante;
  }

  private async obtenerImagenOFallar(idProducto: number, idImagen: number): Promise<ImagenProducto> {
    const imagen = await this.imagenRepo.findById(idImagen);
    if (!imagen || imagen.idProducto !== idProducto) {
      throw new NotFoundException('Imagen no encontrada');
    }
    return imagen;
  }
}
