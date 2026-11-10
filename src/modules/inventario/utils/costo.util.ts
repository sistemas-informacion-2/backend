import type { EntityManager } from 'typeorm';
import { Inventario } from '../entities/inventario.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';

const redondear4 = (valor: number): number => Math.round((valor + Number.EPSILON) * 10_000) / 10_000;

/**
 * Costo promedio ponderado despues de ingresar `cantidad` unidades a `costoUnitario` sobre `stockPrevio`
 * unidades que costaban `costoPrevio`. Sin costo previo conocido (o sin stock previo), manda el de la entrada.
 */
export function costoPromedioPonderado(stockPrevio: number, costoPrevio: number | null, cantidad: number, costoUnitario: number): number {
  if (costoPrevio === null || stockPrevio <= 0) return redondear4(costoUnitario);
  return redondear4((stockPrevio * costoPrevio + cantidad * costoUnitario) / (stockPrevio + cantidad));
}

/**
 * Recalcula el costo promedio de la variante por una entrada de mercaderia (compra o stock inicial). Debe correr
 * dentro de la transaccion de la entrada y ANTES de sumar esas unidades al inventario: bloquea la variante para que
 * dos entradas simultaneas no pisen el promedio, y toma como stock previo lo que hay en todos sus almacenes
 * (disponible + reservado, porque lo reservado sigue siendo de la tienda).
 */
export async function registrarCostoDeEntrada(
  manager: EntityManager,
  idVarianteProducto: number,
  cantidad: number,
  costoUnitario: number,
): Promise<void> {
  if (cantidad <= 0) return;
  const varianteRepo = manager.getRepository(VarianteProducto);
  const variante = await varianteRepo.findOne({ where: { id: idVarianteProducto }, lock: { mode: 'pessimistic_write' } });
  if (!variante) return;

  const existencias = await manager.getRepository(Inventario).find({
    where: { idVarianteProducto },
    select: { id: true, stockDisponible: true, stockReservado: true },
  });
  const stockPrevio = existencias.reduce((total, fila) => total + fila.stockDisponible + fila.stockReservado, 0);

  variante.costoPromedio = costoPromedioPonderado(stockPrevio, variante.costoPromedio, cantidad, costoUnitario);
  await varianteRepo.save(variante);
}
