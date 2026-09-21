import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Departamento } from './departamento.entity.js';
import { Sucursal } from './sucursal.entity.js';

@Entity('ciudad')
export class Ciudad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_departamento', type: 'int' })
  idDepartamento: number;

  @ManyToOne(() => Departamento, (departamento) => departamento.ciudades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_departamento' })
  departamento: Relation<Departamento>;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  ubicacion: string | null;

  @OneToMany(() => Sucursal, (sucursal) => sucursal.ciudad)
  sucursales: Relation<Sucursal>[];
}
