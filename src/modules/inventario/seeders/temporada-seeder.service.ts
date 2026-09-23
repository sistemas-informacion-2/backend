import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Temporada } from '../entities/temporada.entity.js';

interface TemporadaSemilla {
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const fecha = (anio: number, mes: number, dia: number): string => `${anio}-${pad(mes)}-${pad(dia)}`;

/**
 * Fechas de las 4 estaciones astronómicas del hemisferio sur (Bolivia): al
 * revés que en el hemisferio norte, aquí Verano es en diciembre-marzo e
 * Invierno en junio-septiembre. Se calculan relativas a "hoy" (no quedan
 * fijas a un año en particular) para que el seeder sirva sin importar cuándo
 * se corra: Otoño/Invierno/Primavera usan el año actual (no cruzan fin de
 * año); Verano sí cruza diciembre->marzo, así que se elige la ocurrencia
 * (la que ya pasó o la que sigue) según en qué mes del año se ejecute esto.
 */
function construirTaxonomia(hoy: Date): TemporadaSemilla[] {
  const anio = hoy.getUTCFullYear();
  const finVeranoEsteAnio = fecha(anio, 3, 20);
  const hoyIso = hoy.toISOString().slice(0, 10);
  // Antes/durante el verano que terminó este marzo -> esa ocurrencia (dic del año pasado a marzo de este).
  // Después -> la próxima (dic de este año a marzo del que viene).
  const veranoEsteAnioTerminado = hoyIso > finVeranoEsteAnio;
  const veranoInicio = veranoEsteAnioTerminado ? fecha(anio, 12, 21) : fecha(anio - 1, 12, 21);
  const veranoFin = veranoEsteAnioTerminado ? fecha(anio + 1, 3, 20) : fecha(anio, 3, 20);

  return [
    {
      nombre: 'Verano',
      descripcion: 'Prendas ligeras y frescas para el calor: diciembre a marzo.',
      fechaInicio: veranoInicio,
      fechaFin: veranoFin,
    },
    {
      nombre: 'Otoño',
      descripcion: 'Capas intermedias para el cambio de clima: marzo a junio.',
      fechaInicio: fecha(anio, 3, 21),
      fechaFin: fecha(anio, 6, 20),
    },
    {
      nombre: 'Invierno',
      descripcion: 'Abrigos y ropa térmica para el frío: junio a septiembre.',
      fechaInicio: fecha(anio, 6, 21),
      fechaFin: fecha(anio, 9, 22),
    },
    {
      nombre: 'Primavera',
      descripcion: 'Colores y prendas frescas para la temporada de flores: septiembre a diciembre.',
      fechaInicio: fecha(anio, 9, 23),
      fechaFin: fecha(anio, 12, 20),
    },
  ];
}

/** Siembra las 4 estaciones del año (calendario del hemisferio sur / Bolivia). Idempotente: no toca las que ya existen. */
@Injectable()
export class TemporadaSeederService {
  private readonly logger = new Logger(TemporadaSeederService.name);

  constructor(@InjectRepository(Temporada) private readonly temporadaRepo: Repository<Temporada>) {}

  async run(): Promise<void> {
    const taxonomia = construirTaxonomia(new Date());
    for (const semilla of taxonomia) {
      const existente = await this.temporadaRepo.findOne({ where: { nombre: semilla.nombre } });
      if (existente) continue;

      await this.temporadaRepo.save(this.temporadaRepo.create(semilla));
      this.logger.log(`Temporada creada: ${semilla.nombre} (${semilla.fechaInicio} a ${semilla.fechaFin})`);
    }
  }
}
