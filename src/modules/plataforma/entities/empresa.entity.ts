import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Plan } from './plan.entity.js';

export type EstadoEmpresa = 'ACTIVA' | 'SUSPENDIDA';

/**
 * Cliente del SaaS: cada empresa (tienda) ve solo sus propios datos. El slug
 * la identifica en las rutas publicas (/t/:slug) y en el header X-Empresa.
 */
// El NIT identifica a la empresa ante Impuestos: no puede repetirse (tambien evita encadenar pruebas gratuitas).
@Index('uq_empresa_nit', ['nit'], { unique: true, where: '"nit" IS NOT NULL' })
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  slug: string;

  /** Nombre comercial (marca): el que ve el publico en la tienda. */
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 150, nullable: true })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  nit: string | null;

  @Column({ type: 'varchar', length: 60, default: 'Bolivia' })
  pais: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ciudad: string | null;

  /** Direccion de la casa matriz. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

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

  @Column({ name: 'id_plan', type: 'int' })
  idPlan: number;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'id_plan' })
  plan: Relation<Plan>;

  /** Hasta cuando esta pagado el plan; null = no vence (tiendas internas o cortesia del superadmin). */
  @Column({ name: 'plan_vence_el', type: 'timestamp', nullable: true })
  planVenceEl: Date | null;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;
}
