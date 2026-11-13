import { analizarCompras, analizarInventario, analizarVentas, cuantosParaLlegarA, type DatosVentas } from './analisis.js';

function ventas(datos: Partial<DatosVentas> = {}): DatosVentas {
  const productos = [
    { nombre: 'Polera', ingresos: 5000, unidades: 100 },
    { nombre: 'Jean', ingresos: 3000, unidades: 20 },
    { nombre: 'Gorra', ingresos: 1000, unidades: 40 },
    { nombre: 'Medias', ingresos: 600, unidades: 60 },
    { nombre: 'Bufanda', ingresos: 400, unidades: 8 },
  ];
  return {
    ingresos: 10000,
    unidades: 228,
    productos,
    totalProductos: productos.length,
    masVendido: productos[0],
    sucursales: [],
    meses: [],
    mesEnCurso: '2026-11',
    ...datos,
  };
}

describe('analizarVentas', () => {
  it('sin ventas lo dice y no inventa nada más', () => {
    const { analisis, oportunidades } = analizarVentas(ventas({ ingresos: 0, productos: [], totalProductos: 0, masVendido: null }));

    expect(analisis).toEqual(['No hay ventas en el período y con los filtros de este reporte.']);
    expect(oportunidades).toEqual([]);
  });

  it('calcula la concentración de los 3 principales y la regla 80/20', () => {
    const { analisis } = analizarVentas(ventas());

    // (5000 + 3000 + 1000) / 10000
    expect(analisis).toContain('Los 3 productos con más ingresos (Polera, Jean y Gorra) generan el 90,0 % del total.');
    // 5000 + 3000 = 80 %
    expect(analisis).toContain('2 de 5 productos generan el 80 % de los ingresos.');
  });

  it('no afirma la regla 80/20 si no tiene todos los productos (más de 500)', () => {
    const { analisis } = analizarVentas(ventas({ totalProductos: 900 }));

    expect(analisis.some((frase) => frase.includes('80 %'))).toBe(false);
  });

  it('explica cuando el más vendido en unidades no es el que más ingresa', () => {
    const datos = ventas();
    const { analisis } = analizarVentas({ ...datos, productos: [datos.productos[1], ...datos.productos.filter((p) => p.nombre !== 'Jean')], masVendido: datos.productos[0] });

    expect(analisis.find((frase) => frase.startsWith('Polera es el más vendido'))).toBe(
      'Polera es el más vendido en unidades (100), pero Jean genera más ingresos (Bs 3.000,00): su precio promedio es Bs 150,00 por unidad, frente a Bs 50,00.',
    );
  });

  it('compara sucursales solo si hay más de una', () => {
    const una = analizarVentas(ventas({ sucursales: [{ nombre: 'Centro', valor: 10000 }] }));
    const dos = analizarVentas(ventas({ sucursales: [{ nombre: 'Centro', valor: 7000 }, { nombre: 'Norte', valor: 3000 }] }));

    expect(una.analisis.some((frase) => frase.includes('Centro'))).toBe(false);
    expect(dos.analisis).toContain('Centro tiene el 70,0 % de los ingresos; Norte, el 30,0 %.');
  });

  it('no habla de tendencia con menos de 3 meses completos (el mes en curso no cuenta)', () => {
    const { analisis } = analizarVentas(
      ventas({ meses: [{ mes: '2026-09', valor: 100 }, { mes: '2026-10', valor: 200 }, { mes: '2026-11', valor: 50 }] }),
    );

    expect(analisis.some((frase) => frase.includes('mejor mes'))).toBe(false);
  });

  it('con 3 meses completos describe el mejor, el peor y el último cambio', () => {
    const { analisis } = analizarVentas(
      ventas({ meses: [{ mes: '2026-08', valor: 1000 }, { mes: '2026-09', valor: 1500 }, { mes: '2026-10', valor: 1200 }] }),
    );

    expect(analisis).toContain('El mejor mes fue septiembre de 2026 (Bs 1.500,00) y el más bajo, agosto de 2026 (Bs 1.000,00).');
    expect(analisis).toContain('En octubre de 2026 los ingresos bajaron un 20,0 % respecto de septiembre de 2026.');
  });

  it('sugiere revisar el stock de los más vendidos, con la concordancia correcta', () => {
    expect(analizarVentas(ventas()).oportunidades[0]).toBe('Revisa el stock de Polera y Medias: son los productos que más unidades venden.');
  });

  it('siempre aclara que los montos no son ganancias', () => {
    expect(analizarVentas(ventas()).notas[0]).toContain('no ganancias');
  });
});

describe('analizarInventario', () => {
  it('cuenta las variantes en stock crítico y sugiere reponerlas', () => {
    const { analisis, oportunidades } = analizarInventario({
      unidades: 400,
      valorCosto: 9000,
      variantesCriticas: 3,
      sucursales: [{ nombre: 'Centro', valor: 300 }, { nombre: 'Norte', valor: 100 }],
      categorias: [{ nombre: 'Poleras', valor: 6000 }, { nombre: 'Jeans', valor: 3000 }],
      productos: [{ nombre: 'Polera', valor: 150 }],
    });

    expect(analisis).toContain('Centro tiene el 75,0 % de las unidades en stock; Norte, el 25,0 %.');
    expect(analisis).toContain('Poleras es la categoría con más valor: el 66,7 % del inventario a costo.');
    expect(analisis.some((frase) => frase.startsWith('3 variantes están en stock crítico'))).toBe(true);
    expect(oportunidades[0]).toContain('Stock crítico');
  });

  it('sin variantes críticas lo dice', () => {
    const { analisis } = analizarInventario({ unidades: 10, valorCosto: 0, variantesCriticas: 0, sucursales: [], categorias: [], productos: [] });
    expect(analisis).toContain('Ninguna variante está en stock crítico.');
  });
});

describe('analizarCompras', () => {
  it('avisa si un proveedor concentra más de la mitad', () => {
    const { analisis, oportunidades } = analizarCompras({
      total: 1000,
      ordenes: 4,
      proveedores: [{ nombre: 'Textil Andina', valor: 700 }, { nombre: 'Moda Sur', valor: 300 }],
      totalProveedores: 2,
      meses: [],
      mesEnCurso: '2026-11',
    });

    expect(analisis).toContain('Se registraron 4 órdenes de compra, con un promedio de Bs 250,00 por orden.');
    expect(analisis).toContain('Textil Andina es el proveedor principal: concentra el 70,0 % de lo comprado.');
    expect(oportunidades[0]).toContain('proveedores alternativos');
  });
});

describe('cuantosParaLlegarA', () => {
  it('cuenta cuántos valores (de mayor a menor) llegan a la fracción', () => {
    expect(cuantosParaLlegarA([50, 30, 10, 10], 0.8)).toBe(2);
    expect(cuantosParaLlegarA([25, 25, 25, 25], 0.8)).toBe(4);
  });
});
