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

  /**
   * El cliente generico de cada empresa al que van las ventas de mostrador sin cliente identificado. Los analisis de
   * clientes (recurrencia, ticket, mejores clientes) lo excluyen: no es una persona.
   */
  @Column({ name: 'es_consumidor_final', type: 'boolean', default: false })
  esConsumidorFinal: boolean;
}
