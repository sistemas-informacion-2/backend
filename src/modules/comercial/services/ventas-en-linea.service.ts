import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';
import { NotaVentaRepository } from '../repositories/nota-venta.repository.js';
import { toVentaResponseDto } from '../mappers/venta.mapper.js';
import type { VentasQueryDto } from '../dto/ventas-query.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

/**
 * Notas de venta de las compras hechas en la tienda en linea (tipo E_COMMERCE), para el personal. Cada compra queda
 * asignada a la sucursal que aporta la mayoria de sus prendas: un empleado ve solo las de sus sucursales.
 */
@Injectable()
export class VentasEnLineaService {
  constructor(
    private readonly notaVentaRepo: NotaVentaRepository,
    @InjectRepository(EmpleadoSucursal) private readonly empleadoSucursalRepo: Repository<EmpleadoSucursal>,
  ) {}

  async listar(query: VentasQueryDto, usuario: ActiveUser): Promise<VentaPaginatedResponseDto> {
    const idsSucursal = await this.sucursalesVisibles(usuario);
    if (idsSucursal && query.idSucursal !== undefined && !idsSucursal.includes(query.idSucursal)) {
      throw new ForbiddenException('No estas asignado a esa sucursal');
    }

    const { items, total } =
      idsSucursal && idsSucursal.length === 0
        ? { items: [], total: 0 }
        : await this.notaVentaRepo.findPage({ ...query, tipoVenta: 'E_COMMERCE', idsSucursal });

    return {
      items: items.map(toVentaResponseDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async obtener(id: number, usuario: ActiveUser): Promise<VentaResponseDto> {
    const venta = await this.notaVentaRepo.findByIdConDetalle(id);
    // Una venta presencial no se abre por aqui: para esta pantalla no existe.
    if (!venta || venta.tipoVenta !== 'E_COMMERCE') throw new NotFoundException('Venta en linea no encontrada');

    const visibles = await this.sucursalesVisibles(usuario);
    if (visibles && !visibles.includes(venta.idSucursal)) throw new ForbiddenException('No estas asignado a la sucursal de esta venta');
    return toVentaResponseDto(venta);
  }

  /** `undefined` = sin restriccion (administrador); un empleado solo ve las sucursales que tiene asignadas. */
  private async sucursalesVisibles(usuario: ActiveUser): Promise<number[] | undefined> {
    if (usuario.tipoUsuario !== 'E') return undefined;
    const asignaciones = await this.empleadoSucursalRepo.find({ where: { idEmpleado: usuario.sub, activo: true } });
    return asignaciones.map((asignacion) => asignacion.idSucursal);
  }
}
