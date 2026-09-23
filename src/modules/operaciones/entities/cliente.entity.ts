import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';

@Entity('cliente')
export class Cliente {
  @PrimaryColumn({ name: 'id_usuario' })
  idUsuario: number;

  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ name: 'ciudad_residencia', type: 'varchar', length: 100, nullable: true })
  ciudadResidencia: string | null;

  @Column({ name: 'direccion_principal', type: 'text', nullable: true })
  direccionPrincipal: string | null;

  @Column({ name: 'puntos_fidelidad', type: 'int', default: 0 })
  puntosFidelidad: number;
}
