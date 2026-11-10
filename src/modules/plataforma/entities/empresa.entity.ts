import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoEmpresa = 'ACTIVA' | 'SUSPENDIDA';

/**
 * Cliente del SaaS: cada empresa (tienda) ve solo sus propios datos. El slug
 * la identifica en las rutas publicas (/t/:slug) y en el header X-Empresa.
 */
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 150, nullable: true })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  nit: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'color_primario', type: 'varchar', length: 7, nullable: true })
  colorPrimario: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVA' })
  estado: EstadoEmpresa;

  @Column({ name: 'zona_horaria', type: 'varchar', length: 60, default: 'America/La_Paz' })
  zonaHoraria: string;

  @Column({ type: 'varchar', length: 3, default: 'BOB' })
  moneda: string;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;
}
