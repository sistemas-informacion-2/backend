import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PasarelaPago, type IntegracionPago } from '../entities/pasarela-pago.entity.js';

interface MetodoPagoBase {
  codigo: string;
  metodo: string;
  integracion: IntegracionPago;
  disponiblePresencial: boolean;
  disponibleLinea: boolean;
}

/**
 * Metodos de pago base (CU16). Efectivo se habilita solo en caja; QR y Tarjeta
 * en ambos canales; PayPal queda inactivo hasta cargar credenciales.
 * Idempotente: crea por `codigo` solo si no existe y reconcilia `integracion`
 * de los base. Los canales solo se inicializan si aun no se configuraron, para
 * no revertir lo que el administrador haya habilitado/deshabilitado.
 */
const METODOS_PAGO_BASE: MetodoPagoBase[] = [
  { codigo: 'EFECTIVO', metodo: 'Efectivo', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: false },
  { codigo: 'QR', metodo: 'QR', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: true },
  { codigo: 'TARJETA', metodo: 'Tarjeta', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: true },
  { codigo: 'PAYPAL', metodo: 'PayPal', integracion: 'API', disponiblePresencial: false, disponibleLinea: false },
];

@Injectable()
export class PasarelaSeederService {
  private readonly logger = new Logger(PasarelaSeederService.name);

  constructor(@InjectRepository(PasarelaPago) private readonly pasarelaRepo: Repository<PasarelaPago>) {}

  async run(): Promise<void> {
    for (const base of METODOS_PAGO_BASE) {
      const existente = await this.pasarelaRepo.findOne({ where: { codigo: base.codigo } });
      if (!existente) {
        await this.pasarelaRepo.save(
          this.pasarelaRepo.create({
            codigo: base.codigo,
            metodo: base.metodo,
            descripcion: null,
            integracion: base.integracion,
            apiKeyEncriptada: null,
            comisionPorcentaje: '0.00',
            disponiblePresencial: base.disponiblePresencial,
            disponibleLinea: base.disponibleLinea,
          }),
        );
        this.logger.log(`Metodo de pago creado: ${base.codigo}`);
        continue;
      }

      const integracionDifiere = existente.integracion !== base.integracion;
      const canalesSinConfigurar = !existente.disponiblePresencial && !existente.disponibleLinea;
      const canalesDifieren =
        canalesSinConfigurar &&
        (existente.disponiblePresencial !== base.disponiblePresencial ||
          existente.disponibleLinea !== base.disponibleLinea);

      if (!integracionDifiere && !canalesDifieren) continue;

      existente.integracion = base.integracion;
      if (canalesDifieren) {
        existente.disponiblePresencial = base.disponiblePresencial;
        existente.disponibleLinea = base.disponibleLinea;
      }
      await this.pasarelaRepo.save(existente);
      this.logger.log(`Metodo de pago actualizado: ${base.codigo}`);
    }
  }
}
