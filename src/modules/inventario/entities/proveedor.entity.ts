import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  empresa: string;

  @Column({ type: 'varchar', length: 50, unique: true })
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
