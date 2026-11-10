import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { InitialSeederService, type DatosAdministrador } from '../../../database/seeders/initial-seeder.service.js';
import { PasarelaSeederService } from '../../comercial/seeders/pasarela-seeder.service.js';
import { CategoriaSeederService } from '../../inventario/seeders/categoria-seeder.service.js';
import { TemporadaSeederService } from '../../inventario/seeders/temporada-seeder.service.js';
import { Empresa } from '../entities/empresa.entity.js';
import { Plan, type CodigoPlan } from '../entities/plan.entity.js';
import { SLUGS_RESERVADOS } from '../dto/empresa.dto.js';

/** Todo lo que hace falta para crear una empresa, venga del superadmin, del registro del portal o de un seeder. */
export interface DatosNuevaEmpresa {
  slug: string;
  /** Nombre comercial (marca). */
  nombre: string;
  razonSocial?: string | null;
  nit?: string | null;
  pais?: string;
  ciudad?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  codigoPlan: CodigoPlan;
  /** Hasta cuando queda pagado el plan; null = no vence. */
  planVenceEl: Date | null;
  admin: DatosAdministrador;
}

/**
 * Alta de una empresa nueva (S5): la deja lista para operar en una sola
 * transaccion, o no crea nada. Usa los mismos seeders con los que el arranque
 * siembra la empresa inicial, asi que una sola fuente define que trae una
 * tienda nueva:
 *
 * 1. la empresa, con su plan y su vencimiento;
 * 2. los roles base (ADMINISTRADOR + 4 operativos) con sus permisos;
 * 3. su administrador (tipo A) con el rol ADMINISTRADOR;
 * 4. los metodos de pago base (Stripe apagado hasta que cargue su llave);
 * 5. la taxonomia de categorias de ropa y las 4 temporadas.
 *
 * Sucursales, almacenes, productos y empleados los carga su administrador.
 */
@Injectable()
export class AprovisionamientoService {
  private readonly logger = new Logger(AprovisionamientoService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly initialSeeder: InitialSeederService,
    private readonly pasarelaSeeder: PasarelaSeederService,
    private readonly categoriaSeeder: CategoriaSeederService,
    private readonly temporadaSeeder: TemporadaSeederService,
  ) {}

  /** Con `manager` corre dentro de esa transaccion (el registro pagado confirma el pago en la misma). */
  async crearEmpresa(datos: DatosNuevaEmpresa, manager?: EntityManager): Promise<Empresa> {
    const empresa = manager ? await this.crearEn(manager, datos) : await this.dataSource.transaction((m) => this.crearEn(m, datos));
    this.logger.log(`Empresa creada: ${empresa.slug} (id ${empresa.id}, plan ${datos.codigoPlan})`);
    return empresa;
  }

  /** Revisa slug y NIT sin crear nada (el registro lo usa antes de mandar a pagar). */
  async validarDisponible(slug: string, nit: string | null, manager: EntityManager = this.dataSource.manager): Promise<void> {
    const limpio = slug.trim().toLowerCase();
    if (SLUGS_RESERVADOS.includes(limpio)) throw new BadRequestException(`La dirección "${limpio}" está reservada; elige otra`);

    const empresaRepo = manager.getRepository(Empresa);
    if (await empresaRepo.exists({ where: { slug: limpio } })) {
      throw new ConflictException(`La dirección "${limpio}" ya está en uso; elige otra`);
    }
    if (nit && (await empresaRepo.exists({ where: { nit } }))) {
      throw new ConflictException('Ya existe una empresa registrada con ese NIT');
    }
  }

  private async crearEn(manager: EntityManager, datos: DatosNuevaEmpresa): Promise<Empresa> {
    const slug = datos.slug.trim().toLowerCase();
    const nit = datos.nit?.trim() || null;
    await this.validarDisponible(slug, nit, manager);

    const plan = await manager.getRepository(Plan).findOne({ where: { codigo: datos.codigoPlan } });
    if (!plan) throw new BadRequestException(`El plan ${datos.codigoPlan} no existe`);

    const empresaRepo = manager.getRepository(Empresa);
    const creada = await empresaRepo.save(
      empresaRepo.create({
        slug,
        nombre: datos.nombre.trim(),
        razonSocial: datos.razonSocial?.trim() || null,
        nit,
        pais: datos.pais?.trim() || 'Bolivia',
        ciudad: datos.ciudad?.trim() || null,
        direccion: datos.direccion?.trim() || null,
        telefono: datos.telefono?.trim() || null,
        idPlan: plan.id,
        planVenceEl: datos.planVenceEl,
      }),
    );
    creada.plan = plan;

    const rolAdmin = await this.initialSeeder.sembrarRolesEn(manager, creada.id);
    await this.initialSeeder.crearAdministradorEn(manager, creada.id, rolAdmin, datos.admin);
    await this.pasarelaSeeder.sembrarEn(manager, creada.id);
    await this.categoriaSeeder.sembrarEn(manager, creada.id);
    await this.temporadaSeeder.sembrarEn(manager, creada.id);
    return creada;
  }
}
