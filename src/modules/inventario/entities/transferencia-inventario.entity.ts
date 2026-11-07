import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Empresa } from '../../plataforma/entities/empresa.entity.js';
import { Almacen } from './almacen.entity.js';
import { VarianteProducto } from './variante-producto.entity.js';

/**
 * Traslado de unidades de una variante entre dos almacenes de la empresa (puede ser entre sucursales). Deja dos
 * movimientos en el kardex con referencia a esta fila: TRANSFERENCIA_SALIDA en el origen y TRANSFERENCIA_ENTRADA en
 * el destino.
 */
@Index('idx_transferencia_empresa_fecha', ['idEmpresa', 'fechaHora'])
@Entity('transferencia_inventario')
export class TransferenciaInventario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_empresa', type: 'int' })
  idEmpresa: number;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @Column({ name: 'id_almacen_origen', type: 'int' })
  idAlmacenOrigen: number;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen_origen' })
  almacenOrigen: Relation<Almacen>;

  @Column({ name: 'id_almacen_destino', type: 'int' })
  idAlmacenDestino: number;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen_destino' })
  almacenDestino: Relation<Almacen>;

  @Column({ name: 'id_variante_producto', type: 'int' })
  idVarianteProducto: number;

  @ManyToOne(() => VarianteProducto)
  @JoinColumn({ name: 'id_variante_producto' })
  variante: Relation<VarianteProducto>;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @Column({ name: 'fecha_hora', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaHora: Date;
}
