import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Codigos fijos de los planes: el codigo (no el id) es lo que usan el registro, los seeders y el frontend. */
export type CodigoPlan = 'PRUEBA' | 'EMPRENDEDOR' | 'PROFESIONAL' | 'EMPRESARIAL';

/** Funciones que se habilitan o no segun el plan (ver @RequierePlan). */
export type FuncionPlan = 'reportesAvanzados' | 'bi';

/** Postgres devuelve NUMERIC como string; lo convertimos a number en ambos sentidos. */
const TRANSFORMER_DECIMAL = {
  to: (valor: number | null) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};

/**
 * Plan de la plataforma DOMINATR. Es global (no tiene id_empresa): lo comparten todas las empresas y lo lee
 * tambien la landing publica. Los limites en null significan "sin limite".
 */
@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo: CodigoPlan;

  @Column({ type: 'varchar', length: 60 })
  nombre: string;

  /** Frase corta de la tarjeta del plan. */
  @Column({ type: 'varchar', length: 200 })
  descripcion: string;

  /** Precio por periodo, en Bs. */
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: TRANSFORMER_DECIMAL })
  precio: number;

  /** Dias que cubre un pago (7 la prueba, 30 los mensuales). */
  @Column({ name: 'duracion_dias', type: 'int' })
  duracionDias: number;

  @Column({ name: 'max_usuarios', type: 'int', nullable: true })
  maxUsuarios: number | null;

  @Column({ name: 'max_sucursales', type: 'int', nullable: true })
  maxSucursales: number | null;

  @Column({ name: 'max_almacenes', type: 'int', nullable: true })
  maxAlmacenes: number | null;

  /** Constructor de reportes y reportes generativos con IA. */
  @Column({ name: 'reportes_avanzados', type: 'boolean', default: false })
  reportesAvanzados: boolean;

  /** Asistente, modelos y estado de los datos del BI. */
  @Column({ type: 'boolean', default: false })
  bi: boolean;

  /** Plan gratuito de prueba: se da una sola vez por NIT y por correo, y no pasa por Stripe. */
  @Column({ name: 'es_prueba', type: 'boolean', default: false })
  esPrueba: boolean;

  /** Lleva la etiqueta "Más elegido" en la landing. */
  @Column({ type: 'boolean', default: false })
  destacado: boolean;

  /** Lista de capacidades que muestra la tarjeta del plan. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  capacidades: string[];

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
