import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Carrito } from '../entities/carrito.entity.js';
import { DetalleCarrito } from '../entities/detalle-carrito.entity.js';

const RELACIONES = { detalles: { variante: { producto: { imagenes: true } } } } as const;

@Injectable()
export class CarritoRepository {
  constructor(
    @InjectRepository(Carrito) private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(DetalleCarrito) private readonly detalleRepo: Repository<DetalleCarrito>,
  ) {}

  findByCliente(idCliente: number): Promise<Carrito | null> {
    return this.carritoRepo.findOne({ where: { idCliente }, relations: RELACIONES });
  }

  /** Crea el carrito con el primer item; si dos peticiones lo crean a la vez, gana la primera y se reutiliza. */
  async obtenerOCrear(idCliente: number): Promise<Carrito> {
    const existente = await this.carritoRepo.findOne({ where: { idCliente } });
    if (existente) return existente;

    try {
      return await this.carritoRepo.save(this.carritoRepo.create({ idCliente, sessionId: null }));
    } catch (error) {
      const codigo = (error as { driverError?: { code?: string } }).driverError?.code;
      if (codigo !== '23505') throw error;
      return this.carritoRepo.findOneOrFail({ where: { idCliente } });
    }
  }

  findDetalle(idCarrito: number, idDetalle: number): Promise<DetalleCarrito | null> {
    return this.detalleRepo.findOne({ where: { id: idDetalle, idCarrito }, relations: { variante: { producto: true } } });
  }

  findDetallePorVariante(idCarrito: number, idVarianteProducto: number): Promise<DetalleCarrito | null> {
    return this.detalleRepo.findOne({ where: { idCarrito, idVarianteProducto } });
  }

  createDetalle(datos: Partial<DetalleCarrito>): DetalleCarrito {
    return this.detalleRepo.create(datos);
  }

  saveDetalle(detalle: DetalleCarrito): Promise<DetalleCarrito> {
    return this.detalleRepo.save(detalle);
  }

  removeDetalle(detalle: DetalleCarrito): Promise<DetalleCarrito> {
    return this.detalleRepo.remove(detalle);
  }

  async vaciar(idCarrito: number): Promise<void> {
    await this.detalleRepo.delete({ idCarrito });
  }

  /** Marca la ultima modificacion (CU14 pide actualizar `fecha_actualizacion` al cambiar el carrito). */
  async tocar(idCarrito: number): Promise<void> {
    await this.carritoRepo.update({ id: idCarrito }, { fechaActualizacion: new Date() });
  }
}
