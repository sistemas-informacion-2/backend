import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InitialSeederService } from '../../../database/seeders/initial-seeder.service.js';
import { PasarelaSeederService } from '../../comercial/seeders/pasarela-seeder.service.js';
import { CategoriaSeederService } from '../../inventario/seeders/categoria-seeder.service.js';
import { TemporadaSeederService } from '../../inventario/seeders/temporada-seeder.service.js';
import { Empresa } from '../entities/empresa.entity.js';
import { SLUGS_RESERVADOS, type CrearEmpresaDto } from '../dto/empresa.dto.js';

/**
 * Alta de una empresa nueva (S5): la deja lista para operar en una sola
 * transaccion, o no crea nada. Usa los mismos seeders con los que el arranque
 * siembra la empresa inicial, asi que una sola fuente define que trae una
 * tienda nueva:
 *
 * 1. la empresa;
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

  async crearEmpresa(dto: CrearEmpresaDto): Promise<Empresa> {
    const slug = dto.slug.trim().toLowerCase();
    if (SLUGS_RESERVADOS.includes(slug)) throw new BadRequestException(`El slug "${slug}" esta reservado`);

    const empresa = await this.dataSource.transaction(async (manager) => {
      const empresaRepo = manager.getRepository(Empresa);
      if (await empresaRepo.exists({ where: { slug } })) {
        throw new ConflictException(`Ya existe una empresa con el slug "${slug}"`);
      }

      const creada = await empresaRepo.save(
        empresaRepo.create({
          slug,
          nombre: dto.nombre.trim(),
          razonSocial: dto.razonSocial?.trim() || null,
          nit: dto.nit?.trim() || null,
        }),
      );
      const rolAdmin = await this.initialSeeder.sembrarRolesEn(manager, creada.id);
      await this.initialSeeder.crearAdministradorEn(manager, creada.id, rolAdmin, dto.admin);
      await this.pasarelaSeeder.sembrarEn(manager, creada.id);
      await this.categoriaSeeder.sembrarEn(manager, creada.id);
      await this.temporadaSeeder.sembrarEn(manager, creada.id);
      return creada;
    });

    this.logger.log(`Empresa creada: ${empresa.slug} (id ${empresa.id})`);
    return empresa;
  }
}
