import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Ciudad } from './ciudad.entity.js';

@Entity('departamento')
export class Departamento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @OneToMany(() => Ciudad, (ciudad) => ciudad.departamento)
  ciudades: Relation<Ciudad>[];
}
