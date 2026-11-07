/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla produce la misma historia. */
export class Aleatorio {
  private estado: number;

  constructor(semilla: number) {
    this.estado = semilla >>> 0;
  }

  /** Numero en [0, 1). */
  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  probabilidad(p: number): boolean {
    return this.siguiente() < p;
  }

  /** Entero en [min, max]. */
  entero(min: number, max: number): number {
    return min + Math.floor(this.siguiente() * (max - min + 1));
  }

  rango(min: number, max: number): number {
    return min + this.siguiente() * (max - min);
  }

  elegir<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.siguiente() * lista.length)] as T;
  }

  /** Elige con pesos relativos. */
  ponderado<T>(lista: readonly T[], peso: (item: T) => number): T {
    const total = lista.reduce((suma, item) => suma + peso(item), 0);
    let r = this.siguiente() * total;
    for (const item of lista) {
      r -= peso(item);
      if (r < 0) return item;
    }
    return lista[lista.length - 1] as T;
  }

  /** Cantidad de eventos de un proceso de Poisson con media `lambda` (Knuth; lambda es chica). */
  poisson(lambda: number): number {
    const limite = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.siguiente();
    } while (p > limite);
    return k - 1;
  }
}
