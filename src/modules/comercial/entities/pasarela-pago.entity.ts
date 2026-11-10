import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';

export type IntegracionPago = 'NINGUNA' | 'API';

/**
 * Catalogo de metodos de pago (CU16). Un metodo puede habilitarse de forma
 * independiente para cada canal: `disponiblePresencial` (caja, CU15) y
 * `disponibleLinea` (e-commerce, CU12/CU13). `codigo` es la clave estable que
 * usa la logica del sistema; `metodo` es el nombre visible editable.
 */
@Index('uq_pasarela_empresa_codigo', ['idEmpresa', 'codigo'], { unique: true })
@Entity('pasarela_de_pago')
export class PasarelaPago {
  @PrimaryGeneratedColumn()
  id: number;

  /** Cada empresa configura sus propios metodos de pago (y sus credenciales). */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 50 })
  metodo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'enum', enum: ['NINGUNA', 'API'], default: 'NINGUNA' })
  integracion: IntegracionPago;

  @Column({ name: 'api_key_encriptada', type: 'text', nullable: true })
  apiKeyEncriptada: string | null;

  @Column({ name: 'comision_porcentaje', type: 'decimal', precision: 5, scale: 2, default: 0 })
  comisionPorcentaje: string;

  @Column({ name: 'disponible_presencial', type: 'boolean', default: false })
  disponiblePresencial: boolean;

  @Column({ name: 'disponible_linea', type: 'boolean', default: false })
  disponibleLinea: boolean;
}
