import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
import { sumarDias } from '../../../common/tenant/plan-vigencia.js';
import { ahora } from '../../../common/utils/reloj.js';
import { Empresa } from '../entities/empresa.entity.js';
import { PagoPlan, type DatosRegistroPendiente } from '../entities/pago-plan.entity.js';
import type { Plan } from '../entities/plan.entity.js';
import { SLUGS_RESERVADOS } from '../dto/empresa.dto.js';
import type { RegistroEmpresaDto, RegistroResponseDto, SlugDisponibleResponseDto, TiendaCreadaDto } from '../dto/registro.dto.js';
import { AprovisionamientoService } from './aprovisionamiento.service.js';
import { CobroPlanService } from './cobro-plan.service.js';
import { PlanesService } from './planes.service.js';

const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_REGISTROS_POR_IP_Y_HORA = 10;
const VENTANA_MS = 60 * 60 * 1000;

/**
 * Registro de empresas desde el portal de DOMINATR (3 pasos: plan, empresa, administrador).
 *
 * - Prueba gratuita: la tienda se crea al instante, con vencimiento a los dias del plan. Una sola por NIT y por
 *   correo del administrador.
 * - Plan de pago: se guarda la solicitud (contrasena ya cifrada) como un pago PENDIENTE y se manda a Stripe. La
 *   tienda se crea recien al confirmar el pago (ver CobroPlanService).
 */
@Injectable()
export class RegistroService {
  private readonly registrosPorIp = new Map<string, number[]>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly aprovisionamiento: AprovisionamientoService,
    private readonly planes: PlanesService,
    private readonly cobro: CobroPlanService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async slugDisponible(valor: string): Promise<SlugDisponibleResponseDto> {
    const slug = (valor ?? '').trim().toLowerCase();
    if (slug.length < 3 || slug.length > 60 || !FORMATO_SLUG.test(slug)) {
      return { slug, disponible: false, motivo: 'Usa entre 3 y 60 minúsculas, números y guiones (ej. moda-andina).' };
    }
    if (SLUGS_RESERVADOS.includes(slug)) return { slug, disponible: false, motivo: 'Esa dirección está reservada.' };
    const enUso = await this.dataSource.getRepository(Empresa).exists({ where: { slug } });
    return { slug, disponible: !enUso, motivo: enUso ? 'Esa dirección ya está en uso.' : null };
  }

  async registrar(dto: RegistroEmpresaDto, ip: string | null): Promise<RegistroResponseDto> {
    this.limitarPorIp(ip);
    const plan = await this.planes.contratable(dto.codigoPlan);
    const datos = this.datosDelFormulario(dto);
    await this.aprovisionamiento.validarDisponible(datos.slug, datos.nit);

    if (plan.esPrueba) return { urlPago: null, tienda: await this.crearPrueba(plan, datos, dto.admin.password) };

    const pago = await this.dataSource.getRepository(PagoPlan).save(
      this.dataSource.getRepository(PagoPlan).create({
        idEmpresa: null,
        idPlan: plan.id,
        tipo: 'ALTA',
        estado: 'PENDIENTE',
        monto: plan.precio,
        datosRegistro: { ...datos, admin: { ...datos.admin, passwordHash: await bcrypt.hash(dto.admin.password, 10) } },
      }),
    );

    const frontend = this.config.get('frontendUrl', { infer: true });
    const sesion = await this.cobro.abrirSesion(pago, {
      descripcion: `DOMINATR · Plan ${plan.nombre} (${plan.duracionDias} días) · ${datos.nombre}`,
      urlRetorno: `${frontend}/registro/retorno`,
      urlCancelado: `${frontend}/registro?plan=${plan.codigo}&pago=cancelado`,
    });
    return { urlPago: sesion.url, tienda: null };
  }

  /** Vuelta de Stripe: crea la empresa y cobra. Si se llama otra vez (recarga), devuelve la tienda ya creada. */
  async confirmar(sessionId: string): Promise<TiendaCreadaDto> {
    const pago = await this.cobro.confirmar(
      sessionId,
      (fila) => fila.tipo === 'ALTA',
      async (manager, fila) => {
        const datos = fila.datosRegistro;
        if (!datos?.admin.passwordHash) throw new BadRequestException('Faltan los datos del registro');
        const desde = ahora();
        const hasta = sumarDias(desde, fila.plan.duracionDias);
        const { admin, ...empresa } = datos;
        const creada = await this.aprovisionamiento.crearEmpresa(
          {
            ...empresa,
            codigoPlan: fila.plan.codigo,
            planVenceEl: hasta,
            admin: { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, telefono: admin.telefono, passwordHash: admin.passwordHash },
          },
          manager,
        );
        fila.idEmpresa = creada.id;
        fila.periodoDesde = desde;
        fila.periodoHasta = hasta;
        // La contrasena ya vive (cifrada) en el usuario: no se deja otra copia en el pago.
        fila.datosRegistro = { ...datos, admin: { ...admin, passwordHash: '' } };
      },
    );
    return this.tiendaCreada(pago);
  }

  private async crearPrueba(plan: Plan, datos: Omit<DatosRegistroPendiente, 'admin'> & { admin: Omit<DatosRegistroPendiente['admin'], 'passwordHash'> }, password: string): Promise<TiendaCreadaDto> {
    await this.validarPruebaDisponible(datos.nit, datos.admin.email);
    const desde = ahora();
    const hasta = sumarDias(desde, plan.duracionDias);

    const pago = await this.dataSource.transaction(async (manager) => {
      const { admin, ...empresa } = datos;
      const creada = await this.aprovisionamiento.crearEmpresa(
        { ...empresa, codigoPlan: plan.codigo, planVenceEl: hasta, admin: { ...admin, password } },
        manager,
      );
      // La prueba tambien queda como un "pago" de Bs 0: es el historial y lo que impide pedir otra.
      const repo = manager.getRepository(PagoPlan);
      const fila = await repo.save(
        repo.create({
          idEmpresa: creada.id,
          idPlan: plan.id,
          tipo: 'ALTA',
          estado: 'PAGADO',
          monto: 0,
          datosRegistro: { ...datos, admin: { ...admin, passwordHash: '' } },
          periodoDesde: desde,
          periodoHasta: hasta,
          fechaPago: desde,
        }),
      );
      fila.plan = plan;
      return fila;
    });
    return this.tiendaCreada(pago);
  }

  private async validarPruebaDisponible(nit: string, email: string): Promise<void> {
    const usadas: unknown[] = await this.dataSource.query(
      `SELECT 1
         FROM pago_plan pp
         JOIN plan p ON p.id = pp.id_plan
        WHERE p.es_prueba AND pp.estado = 'PAGADO'
          AND (pp.datos_registro->>'nit' = $1 OR lower(pp.datos_registro->'admin'->>'email') = $2)
        LIMIT 1`,
      [nit, email],
    );
    if (usadas.length > 0) {
      throw new ConflictException('Ya se usó una prueba gratuita con ese NIT o ese correo. Elige un plan de pago para continuar.');
    }
  }

  private async tiendaCreada(pago: PagoPlan): Promise<TiendaCreadaDto> {
    const empresa = pago.idEmpresa ? await this.dataSource.getRepository(Empresa).findOne({ where: { id: pago.idEmpresa } }) : null;
    if (!empresa) throw new NotFoundException('La tienda todavía no se creó');
    return {
      slug: empresa.slug,
      nombre: empresa.nombre,
      adminEmail: pago.datosRegistro?.admin.email ?? '',
      codigoPlan: pago.plan.codigo,
      planNombre: pago.plan.nombre,
      venceEl: empresa.planVenceEl,
    };
  }

  private datosDelFormulario(dto: RegistroEmpresaDto) {
    const { empresa, admin } = dto;
    return {
      slug: empresa.slug,
      nombre: empresa.nombreComercial?.trim() || empresa.razonSocial,
      razonSocial: empresa.razonSocial,
      nit: empresa.nit,
      pais: empresa.pais,
      ciudad: empresa.ciudad,
      direccion: empresa.direccion?.trim() || null,
      telefono: empresa.telefono?.trim() || null,
      admin: { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, telefono: admin.telefono?.trim() || null },
    };
  }

  private limitarPorIp(ip: string | null): void {
    if (!ip) return;
    const momento = Date.now();
    const recientes = (this.registrosPorIp.get(ip) ?? []).filter((instante) => momento - instante < VENTANA_MS);
    if (recientes.length >= MAX_REGISTROS_POR_IP_Y_HORA) {
      throw new HttpException('Demasiados registros desde esta conexión. Intenta de nuevo más tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(momento);
    this.registrosPorIp.set(ip, recientes);
  }
}
