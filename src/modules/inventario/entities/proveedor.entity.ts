import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';

@Index('uq_proveedor_empresa_nit', ['idEmpresa', 'nit'], { unique: true })
@Entity('proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn()
  id: number;

  /** Empresa (tienda) duena del registro. La relacion no se llama empresa porque esa propiedad ya es el nombre comercial del proveedor. */
  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresaDuena: Relation<Empresa>;

  @Column({ type: 'varchar', length: 150 })
  empresa: string;

  @Column({ type: 'varchar', length: 50 })
  nit: string;

  @Column({ name: 'nombre_contacto', type: 'varchar', length: 100, nullable: true })
  nombreContacto: string | null;

  @Column({ name: 'telefono_contacto', type: 'varchar', length: 20, nullable: true })
  telefonoContacto: string | null;

  @Column({ name: 'correo_contacto', type: 'varchar', length: 150, nullable: true })
  correoContacto: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
