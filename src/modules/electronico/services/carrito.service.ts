import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { DisponibilidadService } from '../../inventario/services/disponibilidad.service.js';
import { precioConDescuento } from '../../inventario/utils/precio.util.js';
import { CarritoRepository } from '../repositories/carrito.repository.js';
import { toCarritoResponseDto } from '../mappers/carrito.mapper.js';
import {
  CANTIDAD_MAXIMA_POR_ITEM,
  type ActualizarItemCarritoDto,
  type AgregarItemCarritoDto,
  type CarritoResponseDto,
} from '../dto/carrito.dto.js';

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class CarritoService {
  constructor(
    private readonly carritoRepo: CarritoRepository,
    private readonly disponibilidad: DisponibilidadService,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
  ) {}

  async obtener(usuario: ActiveUser): Promise<CarritoResponseDto> {
    const carrito = await this.carritoRepo.findByCliente(this.idCliente(usuario));
    return this.armar(carrito);
  }

  /** Si la variante ya esta en el carrito, suma la cantidad; si no, la inserta (CU14). */
  async agregarItem(usuario: ActiveUser, dto: AgregarItemCarritoDto): Promise<CarritoResponseDto> {
    const idCliente = this.idCliente(usuario);
    const variante = await this.buscarVarianteVendible(dto.idVarianteProducto);
    const stock = await this.stockDe(variante.id);

    const carrito = await this.carritoRepo.obtenerOCrear(idCliente);
    const existente = await this.carritoRepo.findDetallePorVariante(carrito.id, variante.id);
    const cantidad = (existente?.cantidad ?? 0) + dto.cantidad;
    this.validarCantidad(cantidad, stock);

    const precio = precioConDescuento(variante.producto.precio, variante.producto.descuentoPorcentaje);
    if (existente) {
      existente.cantidad = cantidad;
      existente.precioUnitario = precio.toFixed(2);
      existente.subtotal = redondear(precio * cantidad).toFixed(2);
      if (dto.notasEspeciales !== undefined) existente.notasEspeciales = dto.notasEspeciales.trim() || null;
      await this.carritoRepo.saveDetalle(existente);
    } else {
      await this.carritoRepo.saveDetalle(
        this.carritoRepo.createDetalle({
          idCarrito: carrito.id,
          idVarianteProducto: variante.id,
          precioUnitario: precio.toFixed(2),
          cantidad,
          subtotal: redondear(precio * cantidad).toFixed(2),
          notasEspeciales: dto.notasEspeciales?.trim() || null,
        }),
      );
    }
    await this.carritoRepo.tocar(carrito.id);

    return this.obtener(usuario);
  }

  /** Fija la cantidad exacta de un item (botones + y - del detalle y del carrito). */
  async actualizarCantidad(usuario: ActiveUser, idDetalle: number, dto: ActualizarItemCarritoDto): Promise<CarritoResponseDto> {
    const carrito = await this.carritoRepo.findByCliente(this.idCliente(usuario));
    const detalle = carrito ? await this.carritoRepo.findDetalle(carrito.id, idDetalle) : null;
    if (!carrito || !detalle) throw new NotFoundException('Item no encontrado en tu carrito');

    const variante = await this.buscarVarianteVendible(detalle.idVarianteProducto);
    this.validarCantidad(dto.cantidad, await this.stockDe(variante.id));

    const precio = precioConDescuento(variante.producto.precio, variante.producto.descuentoPorcentaje);
    detalle.cantidad = dto.cantidad;
    detalle.precioUnitario = precio.toFixed(2);
    detalle.subtotal = redondear(precio * dto.cantidad).toFixed(2);
    await this.carritoRepo.saveDetalle(detalle);
    await this.carritoRepo.tocar(carrito.id);

    return this.obtener(usuario);
  }

  async quitarItem(usuario: ActiveUser, idDetalle: number): Promise<CarritoResponseDto> {
    const carrito = await this.carritoRepo.findByCliente(this.idCliente(usuario));
    const detalle = carrito ? await this.carritoRepo.findDetalle(carrito.id, idDetalle) : null;
    if (!carrito || !detalle) throw new NotFoundException('Item no encontrado en tu carrito');

    await this.carritoRepo.removeDetalle(detalle);
    await this.carritoRepo.tocar(carrito.id);

    return this.obtener(usuario);
  }

  async vaciar(usuario: ActiveUser): Promise<CarritoResponseDto> {
    const carrito = await this.carritoRepo.findByCliente(this.idCliente(usuario));
    if (carrito) {
      await this.carritoRepo.vaciar(carrito.id);
      await this.carritoRepo.tocar(carrito.id);
    }
    return this.obtener(usuario);
  }

  private async armar(carrito: Awaited<ReturnType<CarritoRepository['findByCliente']>>): Promise<CarritoResponseDto> {
    const ids = (carrito?.detalles ?? []).map((detalle) => detalle.idVarianteProducto);
    return toCarritoResponseDto(carrito, await this.disponibilidad.stockPorVariante(ids));
  }

  private idCliente(usuario: ActiveUser): number {
    if (usuario.tipoUsuario !== 'C') throw new ForbiddenException('El carrito virtual es solo para clientes');
    return usuario.sub;
  }

  private async buscarVarianteVendible(idVariante: number): Promise<VarianteProducto> {
    const variante = await this.varianteRepo.findOne({ where: { id: idVariante }, relations: { producto: true } });
    if (!variante || !variante.activo || !variante.producto?.activo) {
      throw new NotFoundException('La variante ya no esta disponible');
    }
    return variante;
  }

  private async stockDe(idVariante: number): Promise<number> {
    return (await this.disponibilidad.stockPorVariante([idVariante])).get(idVariante) ?? 0;
  }

  private validarCantidad(cantidad: number, stock: number): void {
    if (cantidad > CANTIDAD_MAXIMA_POR_ITEM) {
      throw new BadRequestException(`Maximo ${CANTIDAD_MAXIMA_POR_ITEM} unidades por variante`);
    }
    if (stock <= 0) throw new ConflictException('Esta variante esta agotada');
    if (cantidad > stock) throw new ConflictException(`Solo quedan ${stock} unidades de esta variante`);
  }
}
