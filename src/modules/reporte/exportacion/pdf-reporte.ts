import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { fechaLocal, horaLocal } from '../../../common/utils/fecha.util.js';
import type { FormatoColumna, ReportResultDto } from '../dto/reporte-builder.dto.js';
import { fechaCorta, formatearBs, formatearNumero, formatearPorcentaje } from './formato.js';
import type { Grafico, Indicador, ResumenReporte } from './resumen.types.js';

/**
 * PDF profesional de un reporte (R5b de PLAN-REPORTES.md), A4, con PDFKit:
 *   1. encabezado con DOMINATR, la tienda, el tipo de reporte, el periodo y la fecha de generacion;
 *   2. (generativo) el pedido del usuario y lo que entendio la IA;
 *   3. tarjetas de indicadores y graficos vectoriales;
 *   4. analisis comercial, oportunidades y notas;
 *   5. el detalle: la tabla con las columnas que eligio el usuario, con el encabezado repetido en cada pagina;
 *   6. pie en todas las paginas: plataforma, confidencialidad, fecha y "Pagina X de Y".
 *
 * Los margenes de PDFKit van en 0 y el espacio se maneja aca: asi PDFKit nunca agrega una pagina por su cuenta (lo
 * haria al escribir el pie, que esta debajo del margen inferior).
 */

export interface TiendaReporte {
  nombre: string;
  /** PNG o JPEG del logo de la tienda; null si no tiene. */
  logo: Buffer | null;
  /** #RRGGBB de la tienda; null = la marca monocroma de DOMINATR. */
  color: string | null;
}

export interface DocumentoReporte {
  /** Nombre del reporte: el del predefinido ("Stock crítico") o el de la fuente ("Ventas"). */
  nombreReporte: string;
  /** Linea bajo el nombre de la tienda: el nombre del predefinido. Sin ella no se repite "Ventas" bajo "REPORTE DE VENTAS". */
  subtitulo?: string;
  resultado: ReportResultDto;
  resumen: ResumenReporte;
  tienda: TiendaReporte;
  generadoEn: Date;
  /** Solo el generativo: el pedido del usuario y la interpretacion. */
  contexto?: { prompt: string; interpretacion: string };
}

const PLATAFORMA = 'DOMINATR';

// A4 en puntos.
const VERTICAL = { ancho: 595.28, alto: 841.89 };
const MARGEN = 40;
/** Alto reservado abajo para el pie. */
const ALTO_PIE = 34;
/** Columnas a partir de las cuales el detalle va en horizontal. */
const COLUMNAS_PARA_HORIZONTAL = 8;

// Paleta: la marca de DOMINATR es monocroma (negro y grises zinc, como el portal).
const TINTA = '#09090b';
const TEXTO = '#27272a';
const SUAVE = '#71717a';
const BORDE = '#e4e4e7';
const FONDO = '#f4f4f5';
const FILA_ALTERNA = '#fafafa';
const ACENTO_POR_DEFECTO = '#18181b';
const GRIS_OTROS = '#d4d4d8';

const FUENTES = { normal: 'Inter-400', medio: 'Inter-600', negrita: 'Inter-700' } as const;
type Fuente = (typeof FUENTES)[keyof typeof FUENTES];

// La fuente viene de npm (@fontsource/inter): viaja dentro de node_modules en la imagen de Docker. PDFKit no lee bien
// el woff2 de este paquete ("Offset is outside the bounds of the DataView"); el woff si.
const require = createRequire(import.meta.url);
const ARCHIVOS_FUENTE: Record<Fuente, string> = {
  'Inter-400': require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
  'Inter-600': require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff'),
  'Inter-700': require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
};

/** Bolsa de compras del icono de DOMINATR (frontend/public/pwa-icon.svg), en un cuadro de 24 x 24. */
const ICONO_BOLSA =
  'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z';

type Doc = InstanceType<typeof PDFDocument>;

export function generarPdfReporte(documento: DocumentoReporte): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: {
      Title: `${documento.resumen.titulo} · ${documento.tienda.nombre}`,
      Author: PLATAFORMA,
      Creator: PLATAFORMA,
      Subject: documento.nombreReporte,
    },
  });
  for (const [nombre, archivo] of Object.entries(ARCHIVOS_FUENTE)) doc.registerFont(nombre, archivo);

  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  new Lienzo(doc, documento).dibujar();
  doc.end();
  return terminado;
}

class Lienzo {
  private y = MARGEN;
  private readonly acento: string;
  private readonly fecha: string;
  private readonly hora: string;

  constructor(
    private readonly doc: Doc,
    private readonly documento: DocumentoReporte,
  ) {
    this.acento = colorValido(documento.tienda.color) ?? ACENTO_POR_DEFECTO;
    this.fecha = fechaCorta(fechaLocal(documento.generadoEn));
    this.hora = horaLocal(documento.generadoEn).slice(0, 5);
  }

  dibujar(): void {
    this.encabezado();
    if (this.documento.contexto) this.pedido(this.documento.contexto);
    this.indicadores(this.documento.resumen.indicadores);
    for (const grafico of this.documento.resumen.graficos) this.grafico(grafico);
    this.analisis();
    this.detalle();
    this.pies();
  }

  // ---------------------------------------------------------------- pagina

  private get pagina(): { ancho: number; alto: number } {
    return { ancho: this.doc.page.width, alto: this.doc.page.height };
  }

  private get anchoUtil(): number {
    return this.pagina.ancho - 2 * MARGEN;
  }

  /** Ultima linea donde puede terminar el contenido, sin pisar el pie. */
  private get limite(): number {
    return this.pagina.alto - MARGEN - ALTO_PIE + 10;
  }

  private nuevaPagina(layout: 'portrait' | 'landscape' = 'portrait'): void {
    this.doc.addPage({ size: 'A4', layout, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    this.y = MARGEN;
  }

  /** Pasa a otra pagina si lo que sigue (de `alto` puntos) no entra en esta. */
  private asegurar(alto: number): void {
    if (this.y + alto > this.limite) this.nuevaPagina();
  }

  // ---------------------------------------------------------------- texto

  private escribir(
    texto: string,
    x: number,
    y: number,
    opciones: { fuente?: Fuente; tam?: number; color?: string; ancho?: number; alinear?: 'left' | 'right' | 'center'; espaciado?: number } = {},
  ): void {
    const { fuente = FUENTES.normal, tam = 9, color = TEXTO, ancho, alinear = 'left', espaciado = 0 } = opciones;
    this.doc.font(fuente).fontSize(tam).fillColor(color);
    const limpio = this.limpiar(texto);
    const ajustado = ancho ? this.ajustar(limpio, ancho - 0.5, espaciado) : limpio;
    // Una sola linea: con `width`, PDFKit parte el texto aunque mida justo el ancho (redondeo); el punto de holgura y
    // el alto de una linea lo impiden.
    this.doc.text(ajustado, x, y, {
      width: ancho ? ancho + 1 : undefined,
      height: ancho ? tam * 1.5 : undefined,
      align: alinear,
      lineBreak: false,
      characterSpacing: espaciado,
    });
  }

  /** Parrafo que puede ocupar varias lineas; devuelve su alto. */
  private parrafo(texto: string, x: number, y: number, ancho: number, opciones: { fuente?: Fuente; tam?: number; color?: string } = {}): number {
    const { fuente = FUENTES.normal, tam = 9.5, color = TEXTO } = opciones;
    this.doc.font(fuente).fontSize(tam).fillColor(color);
    const limpio = sinCortes(this.limpiar(texto));
    this.doc.text(limpio, x, y, { width: ancho, lineGap: 2.5 });
    return this.doc.heightOfString(limpio, { width: ancho, lineGap: 2.5 });
  }

  private altoParrafo(texto: string, ancho: number, tam = 9.5, fuente: Fuente = FUENTES.normal): number {
    this.doc.font(fuente).fontSize(tam);
    return this.doc.heightOfString(sinCortes(this.limpiar(texto)), { width: ancho, lineGap: 2.5 });
  }

  /** Recorta con "…" hasta que entre en el ancho (con la fuente y el tamano ya elegidos). */
  private ajustar(texto: string, ancho: number, espaciado = 0): string {
    const mide = (t: string) => this.doc.widthOfString(t, { characterSpacing: espaciado });
    if (mide(texto) <= ancho) return texto;
    let corto = texto;
    while (corto.length > 1 && mide(`${corto}…`) > ancho) corto = corto.slice(0, -1);
    return `${corto.trimEnd()}…`;
  }

  /** Un caracter que la fuente no tiene saldria como un cuadro vacio: se cambia por "?". */
  private limpiar(texto: string): string {
    const fuente = (this.doc as unknown as { _font?: { font?: { hasGlyphForCodePoint?: (c: number) => boolean } } })._font?.font;
    if (!fuente?.hasGlyphForCodePoint) return texto;
    return [...texto].map((c) => (c === '\n' || fuente.hasGlyphForCodePoint!(c.codePointAt(0)!) ? c : '?')).join('');
  }

  // ---------------------------------------------------------------- encabezado

  private encabezado(): void {
    const { resumen, tienda, subtitulo } = this.documento;
    const x = MARGEN;

    // Marca de la plataforma y fecha de generacion.
    this.doc.roundedRect(x, this.y, 22, 22, 5).fill(TINTA);
    this.doc.save().translate(x + 3, this.y + 3).scale(16 / 24).path(ICONO_BOLSA).fill('#ffffff').restore();
    this.escribir(PLATAFORMA, x + 30, this.y + 6, { fuente: FUENTES.negrita, tam: 10, color: TINTA, espaciado: 1.2 });
    this.escribir(`Generado el ${this.fecha} a las ${this.hora}`, x, this.y + 7, { tam: 8, color: SUAVE, ancho: this.anchoUtil, alinear: 'right' });
    this.y += 34;
    this.linea(this.y);
    this.y += 18;

    // Tienda (con su logo o sus iniciales) y tipo de reporte.
    const tamLogo = 46;
    const conMarca = this.marcaTienda(tienda, x + this.anchoUtil - tamLogo, this.y, tamLogo);
    const anchoTitulo = this.anchoUtil - (conMarca ? tamLogo + 16 : 0);
    this.escribir(resumen.titulo, x, this.y, { fuente: FUENTES.negrita, tam: 8.5, color: this.acento, espaciado: 1.6, ancho: anchoTitulo });
    this.escribir(tienda.nombre, x, this.y + 14, { fuente: FUENTES.negrita, tam: 22, color: TINTA, ancho: anchoTitulo });
    if (subtitulo) this.escribir(subtitulo, x, this.y + 44, { tam: 11, color: SUAVE, ancho: anchoTitulo });
    this.y += subtitulo ? 68 : 52;

    // Periodo y sucursal como "etiquetas".
    let xEtiqueta = x;
    for (const [nombre, valor] of this.metadatos()) {
      xEtiqueta += this.etiqueta(nombre, valor, xEtiqueta, this.y) + 8;
    }
    this.y += 34;
  }

  private metadatos(): Array<[string, string]> {
    const { periodo, sucursal } = this.documento.resumen;
    const datos: Array<[string, string]> = [];
    if (periodo) datos.push(['Período', textoPeriodo(periodo)]);
    datos.push(['Sucursal', sucursal ?? 'Todas']);
    return datos;
  }

  /** "Período  01/08/2026 – 31/10/2026" en una cajita; devuelve su ancho. */
  private etiqueta(nombre: string, valor: string, x: number, y: number): number {
    this.doc.font(FUENTES.medio).fontSize(8);
    const anchoNombre = this.doc.widthOfString(nombre);
    this.doc.font(FUENTES.normal).fontSize(8.5);
    const anchoValor = this.doc.widthOfString(this.limpiar(valor));
    const ancho = anchoNombre + anchoValor + 26;
    this.doc.roundedRect(x, y, ancho, 20, 10).fill(FONDO);
    this.escribir(nombre, x + 10, y + 6, { fuente: FUENTES.medio, tam: 8, color: SUAVE });
    this.escribir(valor, x + 16 + anchoNombre, y + 5.5, { tam: 8.5, color: TINTA });
    return ancho;
  }

  /** Logo de la tienda si es una imagen valida; si no, sus iniciales. Devuelve si dibujo algo. */
  private marcaTienda(tienda: TiendaReporte, x: number, y: number, tam: number): boolean {
    if (tienda.logo) {
      try {
        this.doc.image(tienda.logo, x, y, { fit: [tam, tam], align: 'center', valign: 'center' });
        return true;
      } catch {
        // Un archivo que no es PNG ni JPEG: se usan las iniciales.
      }
    }
    const iniciales = tienda.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0]!.toUpperCase())
      .join('');
    if (!iniciales) return false;
    this.doc.roundedRect(x, y, tam, tam, 10).fill(this.acento);
    this.escribir(iniciales, x, y + tam / 2 - 9, { fuente: FUENTES.negrita, tam: 16, color: '#ffffff', ancho: tam, alinear: 'center' });
    return true;
  }

  private linea(y: number, x = MARGEN, ancho = this.anchoUtil): void {
    this.doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.6).strokeColor(BORDE).stroke();
  }

  // ---------------------------------------------------------------- generativo

  private pedido(contexto: { prompt: string; interpretacion: string }): void {
    const x = MARGEN;
    const ancho = this.anchoUtil - 28;
    const altoPedido = this.altoParrafo(`“${contexto.prompt}”`, ancho, 10);
    const altoInterpretacion = this.altoParrafo(contexto.interpretacion, ancho, 9.5);
    const alto = 22 + altoPedido + 22 + altoInterpretacion + 14;
    this.asegurar(alto);

    this.doc.roundedRect(x, this.y, this.anchoUtil, alto, 8).fill(FONDO);
    this.doc.rect(x, this.y + 10, 3, alto - 20).fill(this.acento);
    let y = this.y + 12;
    this.escribir('TU PEDIDO', x + 16, y, { fuente: FUENTES.negrita, tam: 7.5, color: SUAVE, espaciado: 1.2 });
    y += 12;
    y += this.parrafo(`“${contexto.prompt}”`, x + 16, y, ancho, { fuente: FUENTES.medio, tam: 10, color: TINTA }) + 10;
    this.escribir('LO QUE ENTENDIÓ DOMINATR', x + 16, y, { fuente: FUENTES.negrita, tam: 7.5, color: SUAVE, espaciado: 1.2 });
    y += 12;
    this.parrafo(contexto.interpretacion, x + 16, y, ancho, { tam: 9.5, color: TEXTO });
    this.y += alto + 18;
  }

  // ---------------------------------------------------------------- indicadores

  private indicadores(indicadores: Indicador[]): void {
    if (indicadores.length === 0) return;
    this.seccion('Indicadores principales');
    // Primero los numericos y despues los de texto (nombres de producto, proveedor...), que necesitan mas ancho.
    const ordenados = [...indicadores.filter((i) => i.formato !== 'TEXTO'), ...indicadores.filter((i) => i.formato === 'TEXTO')];
    for (const fila of filasDeTarjetas(ordenados)) {
      const alto = 66;
      this.asegurar(alto + 10);
      const separacion = 10;
      const ancho = (this.anchoUtil - separacion * (fila.length - 1)) / fila.length;
      fila.forEach((indicador, i) => this.tarjeta(indicador, MARGEN + i * (ancho + separacion), this.y, ancho, alto));
      this.y += alto + separacion;
    }
    this.y += 14;
  }

  private tarjeta(indicador: Indicador, x: number, y: number, ancho: number, alto: number): void {
    this.doc.roundedRect(x, y, ancho, alto, 8).lineWidth(0.8).fillAndStroke('#ffffff', BORDE);
    const interior = ancho - 28;
    this.escribir(indicador.etiqueta.toUpperCase(), x + 14, y + 12, { fuente: FUENTES.medio, tam: 7, color: SUAVE, espaciado: 0.8, ancho: interior });
    const esTexto = indicador.formato === 'TEXTO';
    this.escribir(valorIndicador(indicador), x + 14, y + (esTexto ? 27 : 25), {
      fuente: FUENTES.negrita,
      tam: esTexto ? 12.5 : 17,
      color: TINTA,
      ancho: interior,
    });
    if (indicador.detalle) this.escribir(indicador.detalle, x + 14, y + 49, { tam: 8, color: SUAVE, ancho: interior });
  }

  private seccion(titulo: string, subtitulo?: string): void {
    this.asegurar(subtitulo ? 46 : 34);
    this.escribir(titulo, MARGEN, this.y, { fuente: FUENTES.negrita, tam: 12, color: TINTA });
    this.y += 18;
    if (subtitulo) {
      this.escribir(subtitulo, MARGEN, this.y, { tam: 8.5, color: SUAVE, ancho: this.anchoUtil });
      this.y += 14;
    }
    this.y += 4;
  }

  // ---------------------------------------------------------------- graficos

  private grafico(grafico: Grafico): void {
    if (grafico.puntos.length === 0) return;
    const alto =
      grafico.tipo === 'ANILLO' ? 150 : grafico.tipo === 'LINEA' ? 170 : grafico.puntos.length * ALTO_BARRA + 10;
    this.asegurar(alto + 40);
    this.escribir(grafico.titulo, MARGEN, this.y, { fuente: FUENTES.medio, tam: 10, color: TINTA });
    this.y += 20;
    if (grafico.tipo === 'ANILLO') this.anillo(grafico, this.y);
    else if (grafico.tipo === 'LINEA') this.lineaTiempo(grafico, this.y, alto);
    else this.barras(grafico, this.y);
    this.y += alto + 22;
  }

  /** Barras horizontales: el nombre a la izquierda (los productos tienen nombres largos), la barra y su valor. */
  private barras(grafico: Grafico, y0: number): void {
    const conRanking = grafico.tipo === 'RANKING';
    const anchoNumero = conRanking ? 18 : 0;
    const anchoNombre = 170;
    const anchoValor = 78;
    const xBarra = MARGEN + anchoNumero + anchoNombre + 8;
    const anchoBarra = this.anchoUtil - anchoNumero - anchoNombre - 8 - anchoValor;
    const maximo = Math.max(...grafico.puntos.map((p) => p.valor), 0);

    grafico.puntos.forEach((punto, i) => {
      const y = y0 + i * ALTO_BARRA;
      if (conRanking) this.escribir(`${i + 1}.`, MARGEN, y + 2, { fuente: FUENTES.medio, tam: 8.5, color: SUAVE });
      this.escribir(punto.etiqueta, MARGEN + anchoNumero, y + 2, { tam: 8.5, color: TEXTO, ancho: anchoNombre });
      this.doc.roundedRect(xBarra, y + 3, anchoBarra, 9, 2).fill(FONDO);
      const largo = maximo > 0 ? Math.max((punto.valor / maximo) * anchoBarra, punto.valor > 0 ? 2 : 0) : 0;
      if (largo > 0) this.doc.roundedRect(xBarra, y + 3, largo, 9, 2).fill(i === 0 ? this.acento : mezclar(this.acento, 0.35));
      this.escribir(valorGrafico(punto.valor, grafico.formato), xBarra + anchoBarra + 8, y + 2, {
        fuente: FUENTES.medio,
        tam: 8.5,
        color: TINTA,
        ancho: anchoValor - 8,
        alinear: 'right',
      });
    });
  }

  /** Anillo de participacion con su leyenda (color, nombre, valor y porcentaje). */
  private anillo(grafico: Grafico, y0: number): void {
    const total = grafico.puntos.reduce((suma, p) => suma + p.valor, 0);
    if (total <= 0) return;
    const radio = 62;
    const grosor = 22;
    const cx = MARGEN + radio + 6;
    const cy = y0 + radio + 6;
    const colores = grafico.puntos.map((p, i) => (p.etiqueta === 'Otros' ? GRIS_OTROS : tonoDe(this.acento, i)));

    if (grafico.puntos.length === 1) {
      this.doc.circle(cx, cy, radio).fill(colores[0]);
    } else {
      let inicio = -Math.PI / 2;
      grafico.puntos.forEach((punto, i) => {
        const fin = inicio + (punto.valor / total) * Math.PI * 2;
        this.doc.path(arco(cx, cy, radio, inicio, fin)).fill(colores[i]);
        inicio = fin;
      });
    }
    this.doc.circle(cx, cy, radio - grosor).fill('#ffffff');
    // En el centro, cuanto pesa el principal.
    this.escribir(formatearPorcentaje(grafico.puntos[0].valor / total), cx - 34, cy - 9, {
      fuente: FUENTES.negrita,
      tam: 13,
      color: TINTA,
      ancho: 68,
      alinear: 'center',
    });
    this.escribir('el principal', cx - 34, cy + 7, { tam: 7, color: SUAVE, ancho: 68, alinear: 'center' });

    // Leyenda.
    const xLeyenda = cx + radio + 34;
    const anchoLeyenda = MARGEN + this.anchoUtil - xLeyenda;
    grafico.puntos.forEach((punto, i) => {
      const y = y0 + 8 + i * 20;
      this.doc.roundedRect(xLeyenda, y + 2, 9, 9, 2).fill(colores[i]);
      this.escribir(punto.etiqueta, xLeyenda + 16, y + 1, { tam: 9, color: TEXTO, ancho: anchoLeyenda - 190 });
      this.escribir(valorGrafico(punto.valor, grafico.formato), xLeyenda + anchoLeyenda - 170, y + 1, {
        fuente: FUENTES.medio,
        tam: 9,
        color: TINTA,
        ancho: 110,
        alinear: 'right',
      });
      this.escribir(formatearPorcentaje(punto.valor / total), xLeyenda + anchoLeyenda - 55, y + 1, { tam: 9, color: SUAVE, ancho: 55, alinear: 'right' });
    });
  }

  /** Linea en el tiempo con area suave, 3 lineas de referencia y los meses abajo. */
  private lineaTiempo(grafico: Grafico, y0: number, alto: number): void {
    const anchoEje = 62;
    const x0 = MARGEN + anchoEje;
    const ancho = this.anchoUtil - anchoEje - 6;
    const altoDibujo = alto - 26;
    const maximo = escalaRedonda(Math.max(...grafico.puntos.map((p) => p.valor), 0));
    const n = grafico.puntos.length;
    const xDe = (i: number) => (n === 1 ? x0 + ancho / 2 : x0 + (i / (n - 1)) * ancho);
    const yDe = (valor: number) => y0 + altoDibujo - (maximo > 0 ? (valor / maximo) * altoDibujo : 0);

    for (let k = 0; k <= 2; k++) {
      const valor = (maximo * k) / 2;
      const y = yDe(valor);
      this.linea(y, x0, ancho);
      this.escribir(valorCompacto(valor, grafico.formato), MARGEN, y - 4.5, { tam: 7.5, color: SUAVE, ancho: anchoEje - 8, alinear: 'right' });
    }

    const puntos = grafico.puntos.map((p, i) => [xDe(i), yDe(p.valor)] as const);
    if (n > 1) {
      const base = yDe(0);
      const area = `M ${puntos[0][0]} ${base} ${puntos.map(([x, y]) => `L ${x} ${y}`).join(' ')} L ${puntos[n - 1][0]} ${base} Z`;
      this.doc.path(area).fillOpacity(0.12).fill(this.acento).fillOpacity(1);
      this.doc.path(`M ${puntos.map(([x, y]) => `${x} ${y}`).join(' L ')}`).lineWidth(1.6).strokeColor(this.acento).stroke();
    }
    for (const [x, y] of puntos) this.doc.circle(x, y, 2.4).fill(this.acento);

    // Meses: todos si entran; si no, uno de cada dos.
    const paso = n > 12 ? 2 : 1;
    grafico.puntos.forEach((punto, i) => {
      if (i % paso !== 0 && i !== n - 1) return;
      this.escribir(punto.etiqueta, xDe(i) - 28, y0 + altoDibujo + 8, { tam: 7.5, color: SUAVE, ancho: 56, alinear: 'center' });
    });
  }

  // ---------------------------------------------------------------- analisis

  private analisis(): void {
    const { analisis, oportunidades, notas } = this.documento.resumen;
    if (analisis.length === 0 && oportunidades.length === 0) return;
    // El analisis se lee de corrido: si no entra entero en lo que queda de la pagina pero si en una pagina nueva, empieza
    // en una nueva (asi no queda una viñeta suelta en una hoja casi vacia).
    const alto = this.altoAnalisis();
    if (this.y + alto > this.limite && MARGEN + alto <= this.limite) this.nuevaPagina();

    this.seccion('Análisis comercial', 'Observaciones calculadas a partir de los datos del reporte.');
    this.vinetas(analisis);
    if (oportunidades.length > 0) {
      this.y += 8;
      this.seccion('Oportunidades de análisis');
      this.vinetas(oportunidades);
    }
    if (notas.length > 0) {
      this.y += 6;
      for (const nota of notas) {
        const alto = this.altoParrafo(nota, this.anchoUtil, 8);
        this.asegurar(alto + 6);
        this.y += this.parrafo(nota, MARGEN, this.y, this.anchoUtil, { tam: 8, color: SUAVE }) + 6;
      }
    }
  }

  /** Alto aproximado de toda la seccion de analisis (titulos, viñetas y notas), con los mismos tamanos que al dibujarla. */
  private altoAnalisis(): number {
    const { analisis, oportunidades, notas } = this.documento.resumen;
    const vinetas = (frases: string[]) => frases.reduce((total, frase) => total + this.altoParrafo(frase, this.anchoUtil - 16) + 8, 0);
    let alto = 36 + vinetas(analisis);
    if (oportunidades.length > 0) alto += 8 + 22 + vinetas(oportunidades);
    if (notas.length > 0) alto += 6 + notas.reduce((total, nota) => total + this.altoParrafo(nota, this.anchoUtil, 8) + 6, 0);
    return alto;
  }

  private vinetas(frases: string[]): void {
    const ancho = this.anchoUtil - 16;
    for (const frase of frases) {
      const alto = this.altoParrafo(frase, ancho);
      this.asegurar(alto + 8);
      this.doc.circle(MARGEN + 3, this.y + 6, 2).fill(this.acento);
      this.y += this.parrafo(frase, MARGEN + 16, this.y, ancho) + 8;
    }
  }

  // ---------------------------------------------------------------- detalle

  private detalle(): void {
    const { resultado } = this.documento;
    if (resultado.columns.length === 0) return;
    this.nuevaPagina(resultado.columns.length >= COLUMNAS_PARA_HORIZONTAL ? 'landscape' : 'portrait');
    const recortado = resultado.rows.length < resultado.total;
    this.seccion(
      'Detalle del reporte',
      recortado
        ? `Se muestran las primeras ${formatearNumero(resultado.rows.length)} de ${formatearNumero(resultado.total)} filas. Los indicadores y gráficos usan todas.`
        : `${formatearNumero(resultado.total)} ${resultado.total === 1 ? 'fila' : 'filas'}.`,
    );

    if (resultado.rows.length === 0) {
      this.escribir('Ninguna fila coincide con los filtros del reporte.', MARGEN, this.y, { tam: 9.5, color: SUAVE });
      this.y += 20;
      return;
    }

    const formatos = resultado.columns.map((_, i) => resultado.columnFormats?.[i] ?? 'TEXTO');
    const celdas = resultado.rows.map((fila) => fila.map((valor, i) => valorCelda(valor, formatos[i])));
    const anchos = this.anchosColumnas(['#', ...resultado.columnLabels], celdas.map((fila, i) => [String(i + 1), ...fila]), ['NUMERO', ...formatos]);
    const alineaciones: Array<'left' | 'right'> = ['right', ...formatos.map((f) => (f === 'NUMERO' || f === 'MONEDA' ? 'right' as const : 'left' as const))];

    this.encabezadoTabla(['#', ...resultado.columnLabels], anchos, alineaciones);
    celdas.forEach((fila, i) => {
      if (this.y + ALTO_FILA > this.limite) {
        this.nuevaPagina(this.doc.page.width > this.doc.page.height ? 'landscape' : 'portrait');
        this.encabezadoTabla(['#', ...resultado.columnLabels], anchos, alineaciones);
      }
      if (i % 2 === 1) this.doc.rect(MARGEN, this.y, this.anchoUtil, ALTO_FILA).fill(FILA_ALTERNA);
      let x = MARGEN;
      [String(i + 1), ...fila].forEach((texto, c) => {
        this.escribir(texto, x + 6, this.y + 5, {
          tam: 8,
          color: c === 0 ? SUAVE : TEXTO,
          ancho: anchos[c] - 12,
          alinear: alineaciones[c],
        });
        x += anchos[c];
      });
      this.y += ALTO_FILA;
      this.linea(this.y);
    });
  }

  /** Encabezado de la tabla: cada titulo puede ocupar dos lineas ("STOCK / DISPONIBLE"); el alto es el del mas alto. */
  private encabezadoTabla(etiquetas: string[], anchos: number[], alineaciones: Array<'left' | 'right'>): void {
    this.doc.font(FUENTES.medio).fontSize(7);
    const opciones = (c: number) => ({ width: anchos[c] - 12, align: alineaciones[c], characterSpacing: 0.6, lineGap: 1 });
    const titulos = etiquetas.map((etiqueta) => this.limpiar(etiqueta.toUpperCase()));
    const lineas = Math.min(2, Math.max(...titulos.map((titulo, c) => Math.round(this.doc.heightOfString(titulo, opciones(c)) / 9.4) || 1)));
    const alto = ALTO_ENCABEZADO + (lineas - 1) * 9;

    this.doc.roundedRect(MARGEN, this.y, this.anchoUtil, alto, 4).fill(TINTA);
    let x = MARGEN;
    titulos.forEach((titulo, c) => {
      this.doc.font(FUENTES.medio).fontSize(7).fillColor('#ffffff');
      // Los titulos de una linea se centran en el alto de la fila.
      const propias = Math.round(this.doc.heightOfString(titulo, opciones(c)) / 9.4) || 1;
      this.doc.text(titulo, x + 6, this.y + 7.5 + (lineas - Math.min(propias, 2)) * 4.5, { ...opciones(c), height: 19 });
      x += anchos[c];
    });
    this.y += alto;
  }

  /**
   * Ancho de cada columna segun su contenido (lo mas ancho entre el encabezado y las primeras 200 filas), ajustado al
   * ancho de la pagina: las columnas de texto ceden o reciben el espacio; las numericas conservan el suyo.
   */
  private anchosColumnas(etiquetas: string[], filas: string[][], formatos: FormatoColumna[]): number[] {
    const naturales = etiquetas.map((etiqueta, c) => {
      this.doc.font(FUENTES.medio).fontSize(7);
      // El titulo puede ir en dos lineas: alcanza con que entre su palabra mas larga. El espaciado entre letras se suma
      // a mano: widthOfString no siempre lo incluye.
      let ancho = Math.max(...etiqueta.toUpperCase().split(/\s+/).map((palabra) => this.doc.widthOfString(palabra) + 0.6 * palabra.length));
      this.doc.font(FUENTES.normal).fontSize(8);
      for (const fila of filas.slice(0, 200)) ancho = Math.max(ancho, this.doc.widthOfString(this.limpiar(fila[c] ?? '')));
      return Math.min(Math.max(ancho + 14, 34), 240);
    });
    const disponible = this.anchoUtil;
    const esTexto = formatos.map((f) => f === 'TEXTO' || f === 'FECHA');
    const fijo = naturales.reduce((suma, ancho, c) => suma + (esTexto[c] ? 0 : ancho), 0);
    const totalTexto = naturales.reduce((suma, ancho, c) => suma + (esTexto[c] ? ancho : 0), 0);
    const cantidadTexto = esTexto.filter(Boolean).length;
    const paraTexto = disponible - fijo;

    // Las columnas numericas conservan su ancho (cifras y titulo completos); las de texto ceden o ganan el resto,
    // sin bajar de 40 puntos. Si ni asi entra, se achica todo en proporcion.
    if (cantidadTexto > 0 && paraTexto >= cantidadTexto * 40) {
      const factor = paraTexto / totalTexto;
      const anchos = naturales.map((ancho, c) => (esTexto[c] ? Math.max(ancho * factor, 40) : ancho));
      const suma = anchos.reduce((a, b) => a + b, 0);
      // Lo que sumaron los minimos de 40 se descuenta de las columnas de texto mas anchas.
      const exceso = suma - disponible;
      if (exceso > 0.5) {
        const anchasTexto = anchos.reduce((total, ancho, c) => total + (esTexto[c] && ancho > 40 ? ancho - 40 : 0), 0);
        return anchos.map((ancho, c) => (esTexto[c] && ancho > 40 ? ancho - (exceso * (ancho - 40)) / anchasTexto : ancho));
      }
      return anchos;
    }
    const total = naturales.reduce((a, b) => a + b, 0);
    return naturales.map((ancho) => (ancho * disponible) / total);
  }

  // ---------------------------------------------------------------- pie

  private pies(): void {
    const { start, count } = this.doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      this.doc.switchToPage(i);
      const { ancho, alto } = this.pagina;
      const y = alto - MARGEN + 6;
      this.linea(y - 10, MARGEN, ancho - 2 * MARGEN);
      this.escribir(`${PLATAFORMA}  ·  Documento confidencial: uso interno de ${this.documento.tienda.nombre}`, MARGEN, y, {
        tam: 7.5,
        color: SUAVE,
        ancho: (ancho - 2 * MARGEN) * 0.65,
      });
      this.escribir(`${this.fecha} ${this.hora}  ·  Página ${i - start + 1} de ${count}`, MARGEN, y, {
        tam: 7.5,
        color: SUAVE,
        ancho: ancho - 2 * MARGEN,
        alinear: 'right',
      });
    }
  }
}

const ALTO_BARRA = 18;
const ALTO_FILA = 18;
const ALTO_ENCABEZADO = 22;

// ---------------------------------------------------------------- utilidades

/** Filas de tarjetas: 3 en la primera y de a 2 en las siguientes (con 5 indicadores, 3 + 2). */
function filasDeTarjetas<T>(elementos: T[]): T[][] {
  if (elementos.length <= 3) return [elementos];
  const filas: T[][] = [elementos.slice(0, 3)];
  for (let i = 3; i < elementos.length; i += 2) filas.push(elementos.slice(i, i + 2));
  return filas;
}

/** "Bs 58.899,87" y "28,2 %" no se parten al final de una linea: el espacio pasa a ser uno que no corta. */
function sinCortes(texto: string): string {
  return texto.replace(/Bs /g, 'Bs ').replace(/ %/g, ' %');
}

function textoPeriodo(periodo: { desde?: string; hasta?: string }): string {
  if (periodo.desde && periodo.hasta) return `${fechaCorta(periodo.desde)} – ${fechaCorta(periodo.hasta)}`;
  if (periodo.desde) return `Desde el ${fechaCorta(periodo.desde)}`;
  if (periodo.hasta) return `Hasta el ${fechaCorta(periodo.hasta)}`;
  return 'Todo el historial';
}

function valorIndicador(indicador: Indicador): string {
  if (indicador.valor === null || indicador.valor === '') return '—';
  if (typeof indicador.valor === 'string') return indicador.valor;
  return indicador.formato === 'MONEDA' ? formatearBs(indicador.valor) : formatearNumero(indicador.valor);
}

function valorGrafico(valor: number, formato: Grafico['formato']): string {
  return formato === 'MONEDA' ? formatearBs(valor) : formatearNumero(valor);
}

/** Valores del eje: "Bs 250 mil", "Bs 1,2 M", "300". */
function valorCompacto(valor: number, formato: Grafico['formato']): string {
  const prefijo = formato === 'MONEDA' ? 'Bs ' : '';
  if (Math.abs(valor) >= 1_000_000) return `${prefijo}${formatearNumero(Math.round(valor / 100_000) / 10)} M`;
  if (Math.abs(valor) >= 1_000) return `${prefijo}${formatearNumero(Math.round(valor / 1_000))} mil`;
  return `${prefijo}${formatearNumero(Math.round(valor))}`;
}

/** Tope del eje redondeado hacia arriba (1, 2 o 5 por potencia de 10), para lineas de referencia limpias. */
function escalaRedonda(maximo: number): number {
  if (maximo <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const paso of [1, 2, 2.5, 5, 10]) if (paso * potencia >= maximo) return paso * potencia;
  return 10 * potencia;
}

function valorCelda(valor: string | number | boolean, formato: FormatoColumna): string {
  if (valor === '' || valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return formato === 'MONEDA' ? formatearBs(valor) : formatearNumero(valor);
  if (formato === 'FECHA' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return fechaCorta(valor);
  return valor;
}

/** Porcion de anillo de `inicio` a `fin` (radianes), como camino SVG. */
function arco(cx: number, cy: number, radio: number, inicio: number, fin: number): string {
  const punto = (angulo: number) => `${cx + radio * Math.cos(angulo)} ${cy + radio * Math.sin(angulo)}`;
  const grande = fin - inicio > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${punto(inicio)} A ${radio} ${radio} 0 ${grande} 1 ${punto(fin)} Z`;
}

function colorValido(color: string | null): string | null {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

/** Mezcla un color con blanco: 0 = el color, 1 = blanco. */
function mezclar(color: string, blanco: number): string {
  const canal = (i: number) => {
    const valor = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(valor + (255 - valor) * blanco)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

/** Tonos del acento para las porciones del anillo, de mas oscuro a mas claro. */
function tonoDe(acento: string, indice: number): string {
  const tonos = [0, 0.28, 0.48, 0.64, 0.78, 0.88];
  return mezclar(acento, tonos[indice % tonos.length]);
}
