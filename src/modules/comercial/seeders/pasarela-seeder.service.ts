import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
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
 * en ambos canales; Stripe queda inactivo hasta cargar la llave secreta.
 * Idempotente: crea por `codigo` solo si no existe y reconcilia `integracion`
 * de los base. Los canales solo se inicializan si aun no se configuraron, para
 * no revertir lo que el administrador haya habilitado/deshabilitado.
 */
const METODOS_PAGO_BASE: MetodoPagoBase[] = [
  { codigo: 'EFECTIVO', metodo: 'Efectivo', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: false },
  { codigo: 'QR', metodo: 'QR', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: true },
  { codigo: 'TARJETA', metodo: 'Tarjeta', integracion: 'NINGUNA', disponiblePresencial: true, disponibleLinea: true },
  { codigo: 'STRIPE', metodo: 'Stripe', integracion: 'API', disponiblePresencial: false, disponibleLinea: false },
];

@Injectable()
export class PasarelaSeederService {
  private readonly logger = new Logger(PasarelaSeederService.name);

  constructor(
    @InjectRepository(PasarelaPago) private readonly pasarelaRepo: Repository<PasarelaPago>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

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

    await this.retirarPaypal();
    await this.activarStripeDesdeEntorno();
  }

  /**
   * PayPal fue reemplazado por Stripe. Su fila no se borra (los pagos historicos la referencian), solo se saca del
   * checkout en linea para que el panel no la muestre como disponible.
   */
  private async retirarPaypal(): Promise<void> {
    const paypal = await this.pasarelaRepo.findOne({ where: { codigo: 'PAYPAL' } });
    if (!paypal?.disponibleLinea) return;

    paypal.disponibleLinea = false;
    await this.pasarelaRepo.save(paypal);
    this.logger.log('PayPal retirado del checkout en linea (reemplazado por Stripe)');
  }

  /**
   * Si el .env trae la llave secreta de Stripe, la primera vez habilita Stripe para el checkout en linea. La
   * descripcion sirve de marca: una vez puesta, el administrador manda y no se vuelve a tocar el canal.
   */
  private async activarStripeDesdeEntorno(): Promise<void> {
    const secretKey = this.config.get('stripe.secretKey', { infer: true });
    if (!secretKey) return;

    const stripe = await this.pasarelaRepo.findOne({ where: { codigo: 'STRIPE' } });
    if (!stripe || stripe.descripcion !== null) return;

    stripe.descripcion = secretKey.startsWith('sk_test_') ? 'Paga con tarjeta en Stripe (modo de pruebas)' : 'Paga con tarjeta en Stripe';
    if (!stripe.disponiblePresencial && !stripe.disponibleLinea) stripe.disponibleLinea = true;
    await this.pasarelaRepo.save(stripe);
    this.logger.log('Stripe habilitado para pagos en linea con la llave del .env');
  }
}
