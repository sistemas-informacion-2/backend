import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { CajaRepository } from '../repositories/caja.repository.js';
import { MovimientoCajaRepository } from '../repositories/movimiento-caja.repository.js';
import { toCajaResponseDto, toMovimientoCajaResponseDto } from '../mappers/caja.mapper.js';
import type { Caja } from '../entities/caja.entity.js';
import type { AbrirCajaDto } from '../dto/abrir-caja.dto.js';
import type { CerrarCajaDto } from '../dto/cerrar-caja.dto.js';
import type { CrearMovimientoCajaDto } from '../dto/crear-movimiento-caja.dto.js';
import type { CajasQueryDto } from '../dto/cajas-query.dto.js';
import type { CajaResponseDto } from '../dto/caja-response.dto.js';
import type { MovimientoCajaResponseDto } from '../dto/movimiento-caja-response.dto.js';

@Injectable()
export class CajaService {
  constructor(
    private readonly cajaRepo: CajaRepository,
    private readonly movimientoRepo: MovimientoCajaRepository,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async listar(query: CajasQueryDto): Promise<CajaResponseDto[]> {
    const cajas = await this.cajaRepo.findWithFilters(query);
    return cajas.map(toCajaResponseDto);
  }

  async abierta(idSucursal: number): Promise<CajaResponseDto | null> {
    const caja = await this.cajaRepo.findAbiertaPorSucursal(idSucursal);
    return caja ? toCajaResponseDto(caja) : null;
  }

  async obtener(id: number): Promise<CajaResponseDto> {
    const caja = await this.cajaRepo.findByIdConDetalle(id);
    if (!caja) throw new NotFoundException('Caja no encontrada');
    return toCajaResponseDto(caja);
  }

  async abrir(dto: AbrirCajaDto, usuario: ActiveUser): Promise<CajaResponseDto> {
    await this.validarSucursal(dto.idSucursal);
    const abierta = await this.cajaRepo.findAbiertaPorSucursal(dto.idSucursal);
    if (abierta) throw new ConflictException('La sucursal ya tiene una caja abierta');

    const ahora = new Date();
    const caja = this.cajaRepo.create({
      idSucursal: dto.idSucursal,
      // La caja queda atada al cajero que la abre. El administrador no tiene
      // legajo de empleado, por eso se registra sin cajero.
      idCajero: usuario.tipoUsuario === 'E' ? usuario.sub : null,
      fechaApertura: ahora,
      horaApertura: formatearHora(ahora),
      montoInicial: dto.montoInicial.toFixed(2),
      estado: 'Abierta',
    });
    await this.cajaRepo.save(caja);

    return this.obtener(caja.id);
  }

  async cerrar(id: number, dto: CerrarCajaDto): Promise<CajaResponseDto> {
    const caja = await this.cajaRepo.findByIdConDetalle(id);
    if (!caja) throw new NotFoundException('Caja no encontrada');
    if (caja.estado !== 'Abierta') throw new ConflictException('La caja ya esta cerrada');

    const ahora = new Date();
    const esperado = this.montoEsperado(caja);
    caja.montoFinal = (dto.montoFinal ?? esperado).toFixed(2);
    caja.fechaCierre = ahora;
    caja.horaCierre = formatearHora(ahora);
    caja.estado = 'Cerrada';
    await this.cajaRepo.save(caja);

    return this.obtener(id);
  }

  async listarMovimientos(id: number): Promise<MovimientoCajaResponseDto[]> {
    const caja = await this.cajaRepo.findByIdConDetalle(id);
    if (!caja) throw new NotFoundException('Caja no encontrada');
    const movimientos = await this.movimientoRepo.findByCaja(id);
    return movimientos.map(toMovimientoCajaResponseDto);
  }

  async registrarMovimiento(id: number, dto: CrearMovimientoCajaDto): Promise<MovimientoCajaResponseDto> {
    const caja = await this.cajaRepo.findByIdConDetalle(id);
    if (!caja) throw new NotFoundException('Caja no encontrada');
    if (caja.estado !== 'Abierta') throw new ConflictException('La caja esta cerrada');

    const movimiento = this.movimientoRepo.create({
      idCaja: id,
      tipo: dto.tipo,
      concepto: dto.concepto.trim(),
      monto: dto.monto.toFixed(2),
      observaciones: dto.observaciones?.trim() || null,
      fechaHora: new Date(),
    });
    await this.movimientoRepo.save(movimiento);

    return toMovimientoCajaResponseDto(movimiento);
  }

  private async validarSucursal(idSucursal: number): Promise<void> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: idSucursal } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
  }

  private montoEsperado(caja: Caja): number {
    const ingresos = (caja.movimientos ?? [])
      .filter((movimiento) => movimiento.tipo === 'INGRESO')
      .reduce((total, movimiento) => total + Number(movimiento.monto), 0);
    const egresos = (caja.movimientos ?? [])
      .filter((movimiento) => movimiento.tipo === 'EGRESO')
      .reduce((total, movimiento) => total + Number(movimiento.monto), 0);
    return Math.round((Number(caja.montoInicial) + ingresos - egresos + Number.EPSILON) * 100) / 100;
  }
}

function formatearHora(fecha: Date): string {
  return fecha.toTimeString().slice(0, 8);
}
