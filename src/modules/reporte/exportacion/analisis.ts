import { enumerar, formatearBs, formatearNumero, formatearPorcentaje, nombreDeMes } from './formato.js';

/**
 * Analisis comercial del PDF y el Excel, con reglas fijas (decision de PLAN-REPORTES.md, R5). Cada frase sale de un
 * calculo sobre los datos del reporte y solo se escribe si los datos la sostienen:
 * - nunca se habla de una tendencia con menos de 3 meses completos;
 * - nunca se habla de rentabilidad: los montos son ventas o compras, no ganancias;
 * - las "oportunidades" son sugerencias de que mirar despues, no conclusiones.
 */
export interface Analisis {
  analisis: string[];
  oportunidades: string[];
  notas: string[];
}

export interface Fila {
  nombre: string;
  valor: number;
}

export interface FilaProducto {
  nombre: string;
  ingresos: number;
  unidades: number;
}

export interface FilaMes {
  /** AAAA-MM */
  mes: string;
  valor: number;
}

/** Meses minimos (completos) para describir una evolucion en el tiempo. */
export const MESES_PARA_TENDENCIA = 3;
/** Participacion que se considera concentrada en pocos productos o proveedores. */
const CONCENTRACION_ALTA = 0.5;

// ---------------------------------------------------------------- ventas

export interface DatosVentas {
  ingresos: number;
  unidades: number;
  /** Productos ordenados por ingresos, de mayor a menor (pueden no ser todos: ver totalProductos). */
  productos: FilaProducto[];
  totalProductos: number;
  /** El mas vendido por unidades (puede no estar entre los de mas ingresos). */
  masVendido: FilaProducto | null;
  sucursales: Fila[];
  meses: FilaMes[];
  /** Mes en curso (AAAA-MM): no cuenta como mes completo. */
  mesEnCurso: string;
}

export function analizarVentas(datos: DatosVentas): Analisis {
  const analisis: string[] = [];
  const oportunidades: string[] = [];
  const notas = ['Los montos son ventas con impuestos, no ganancias: para ver la rentabilidad usa el margen bruto del Constructor o el BI.'];

  if (datos.ingresos <= 0) {
    return { analisis: ['No hay ventas en el período y con los filtros de este reporte.'], oportunidades, notas };
  }

  const { productos, totalProductos } = datos;
  const completos = productos.length === totalProductos;

  if (totalProductos === 1 && productos[0]) {
    analisis.push(`Todo lo vendido corresponde a ${productos[0].nombre}.`);
  } else if (totalProductos >= 2 && totalProductos <= 3 && completos) {
    analisis.push(`Participación en los ingresos: ${enumerar(productos.map((p) => `${p.nombre} ${formatearPorcentaje(p.ingresos / datos.ingresos)}`))}.`);
  } else if (totalProductos >= 4) {
    const top = productos.slice(0, 3);
    const parte = suma(top.map((p) => p.ingresos)) / datos.ingresos;
    analisis.push(`Los 3 productos con más ingresos (${enumerar(top.map((p) => p.nombre))}) generan el ${formatearPorcentaje(parte)} del total.`);
  }

  const pareto = completos && totalProductos >= 5 ? cuantosParaLlegarA(productos.map((p) => p.ingresos), 0.8) : null;
  if (pareto !== null) {
    analisis.push(`${formatearNumero(pareto)} de ${formatearNumero(totalProductos)} productos generan el 80 % de los ingresos.`);
    if (pareto / totalProductos <= 0.3) {
      oportunidades.push('Pocos productos sostienen la mayoría de los ingresos: conviene revisar por qué el resto se vende menos.');
    }
  }

  const masIngresos = productos[0];
  const masVendido = datos.masVendido;
  if (masIngresos && masVendido && masVendido.nombre !== masIngresos.nombre && masVendido.unidades > 0 && masIngresos.unidades > 0) {
    analisis.push(
      `${masVendido.nombre} es el más vendido en unidades (${formatearNumero(masVendido.unidades)}), pero ${masIngresos.nombre} genera más ingresos ` +
        `(${formatearBs(masIngresos.ingresos)}): su precio promedio es ${formatearBs(masIngresos.ingresos / masIngresos.unidades)} por unidad, ` +
        `frente a ${formatearBs(masVendido.ingresos / masVendido.unidades)}.`,
    );
  } else if (masIngresos && masIngresos.unidades > 0 && totalProductos > 1) {
    analisis.push(`${masIngresos.nombre} es a la vez el más vendido en unidades y el que más ingresos genera.`);
  }

  if (masVendido) {
    const segundo = datos.productos.filter((p) => p.nombre !== masVendido.nombre).sort((a, b) => b.unidades - a.unidades)[0];
    const nombres = segundo ? [masVendido.nombre, segundo.nombre] : [masVendido.nombre];
    oportunidades.push(
      `Revisa el stock de ${enumerar(nombres)}: ${nombres.length > 1 ? 'son los productos que más unidades venden' : 'es el producto que más unidades vende'}.`,
    );
  }

  analizarParticipacion(datos.sucursales, datos.ingresos, 'de los ingresos', analisis);
  if (datos.sucursales.length >= 2) {
    const [primera, ultima] = [datos.sucursales[0], datos.sucursales[datos.sucursales.length - 1]];
    if (primera.valor > 0 && ultima.valor < primera.valor) {
      oportunidades.push(`Compara qué se vende en ${primera.nombre} y no en ${ultima.nombre}: hay una diferencia de ${formatearBs(primera.valor - ultima.valor)}.`);
    }
  }

  analizarMeses(datos.meses, datos.mesEnCurso, 'los ingresos', analisis);
  return { analisis, oportunidades, notas };
}

// ---------------------------------------------------------------- inventario

export interface DatosInventario {
  unidades: number;
  valorCosto: number;
  variantesCriticas: number;
  sucursales: Fila[];
  /** Valor a costo por categoria, de mayor a menor. */
  categorias: Fila[];
  /** Productos con mas unidades, de mayor a menor. */
  productos: Fila[];
}

export function analizarInventario(datos: DatosInventario): Analisis {
  const analisis: string[] = [];
  const oportunidades: string[] = [];
  const notas = ['El valor a costo usa el costo promedio de cada variante; las que nunca se compraron no tienen costo y no suman.'];

  if (datos.unidades <= 0) {
    return { analisis: ['No hay unidades en stock con los filtros de este reporte.'], oportunidades, notas };
  }

  analizarParticipacion(datos.sucursales, datos.unidades, 'de las unidades en stock', analisis);

  const categoria = datos.categorias[0];
  if (categoria && datos.valorCosto > 0 && datos.categorias.length >= 2) {
    analisis.push(`${categoria.nombre} es la categoría con más valor: el ${formatearPorcentaje(categoria.valor / datos.valorCosto)} del inventario a costo.`);
  }

  if (datos.variantesCriticas > 0) {
    analisis.push(
      `${formatearNumero(datos.variantesCriticas)} ${datos.variantesCriticas === 1 ? 'variante está' : 'variantes están'} en stock crítico ` +
        '(con stock igual o menor al mínimo configurado), contando cada almacén por separado.',
    );
    oportunidades.push('Prioriza la reposición de las variantes en stock crítico: el reporte predefinido «Stock crítico» las lista una por una.');
  } else {
    analisis.push('Ninguna variante está en stock crítico.');
  }

  const producto = datos.productos[0];
  if (producto) {
    oportunidades.push(`${producto.nombre} es el producto con más unidades (${formatearNumero(producto.valor)}): compáralo con sus ventas para ver si hay sobrestock.`);
  }
  return { analisis, oportunidades, notas };
}

// ---------------------------------------------------------------- compras

export interface DatosCompras {
  total: number;
  ordenes: number;
  /** Total comprado por proveedor, de mayor a menor. */
  proveedores: Fila[];
  totalProveedores: number;
  meses: FilaMes[];
  mesEnCurso: string;
}

export function analizarCompras(datos: DatosCompras): Analisis {
  const analisis: string[] = [];
  const oportunidades: string[] = [];
  const notas: string[] = [];

  if (datos.total <= 0) {
    return { analisis: ['No hay compras en el período y con los filtros de este reporte.'], oportunidades, notas };
  }

  if (datos.ordenes > 0) {
    analisis.push(`Se registraron ${formatearNumero(datos.ordenes)} órdenes de compra, con un promedio de ${formatearBs(datos.total / datos.ordenes)} por orden.`);
  }

  const principal = datos.proveedores[0];
  if (principal && datos.totalProveedores >= 2) {
    const parte = principal.valor / datos.total;
    analisis.push(`${principal.nombre} es el proveedor principal: concentra el ${formatearPorcentaje(parte)} de lo comprado.`);
    if (parte > CONCENTRACION_ALTA) {
      oportunidades.push(`Más de la mitad de las compras dependen de ${principal.nombre}: conviene tener proveedores alternativos.`);
    }
  } else if (principal) {
    analisis.push(`Todas las compras del período son a ${principal.nombre}.`);
  }

  analizarMeses(datos.meses, datos.mesEnCurso, 'las compras', analisis);
  oportunidades.push('Compara estas compras con las ventas del mismo período para ver qué se repone más rápido de lo que se vende.');
  return { analisis, oportunidades, notas };
}

// ---------------------------------------------------------------- comunes

/** "A tiene el 60 % de los ingresos; B, el 40 %." Solo con dos o mas filas. */
function analizarParticipacion(filas: Fila[], total: number, deQue: string, analisis: string[]): void {
  if (filas.length < 2 || total <= 0) return;
  const [primera, ...resto] = filas.slice(0, 3);
  const otras = resto.map((fila) => `${fila.nombre}, el ${formatearPorcentaje(fila.valor / total)}`).join('; ');
  analisis.push(`${primera.nombre} tiene el ${formatearPorcentaje(primera.valor / total)} ${deQue}; ${otras}.`);
}

/**
 * Evolucion por mes, solo con meses completos (el mes en curso no cuenta) y solo si hay al menos
 * MESES_PARA_TENDENCIA: mejor y peor mes, y la variacion del ultimo mes completo frente al anterior.
 */
function analizarMeses(meses: FilaMes[], mesEnCurso: string, deQue: string, analisis: string[]): void {
  const completos = meses.filter((fila) => fila.mes !== mesEnCurso).sort((a, b) => a.mes.localeCompare(b.mes));
  if (completos.length < MESES_PARA_TENDENCIA) return;

  const mejor = completos.reduce((a, b) => (b.valor > a.valor ? b : a));
  const peor = completos.reduce((a, b) => (b.valor < a.valor ? b : a));
  analisis.push(`El mejor mes fue ${nombreDeMes(mejor.mes)} (${formatearBs(mejor.valor)}) y el más bajo, ${nombreDeMes(peor.mes)} (${formatearBs(peor.valor)}).`);

  const [anterior, ultimo] = completos.slice(-2);
  if (anterior.valor > 0) {
    const cambio = ultimo.valor / anterior.valor - 1;
    const sentido = cambio >= 0 ? 'subieron' : 'bajaron';
    analisis.push(`En ${nombreDeMes(ultimo.mes)} ${deQue} ${sentido} un ${formatearPorcentaje(Math.abs(cambio))} respecto de ${nombreDeMes(anterior.mes)}.`);
  }
}

/** Cuantos valores (ya ordenados de mayor a menor) hacen falta para llegar a la fraccion del total. */
export function cuantosParaLlegarA(valores: number[], fraccion: number): number {
  const total = suma(valores);
  let acumulado = 0;
  for (let i = 0; i < valores.length; i++) {
    acumulado += valores[i];
    if (acumulado >= total * fraccion) return i + 1;
  }
  return valores.length;
}

function suma(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}
