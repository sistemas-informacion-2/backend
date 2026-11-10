// Primero: fija la zona horaria del proceso antes de que se cree cualquier Date.
import '../../config/zona-horaria.js';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module.js';
import { TenantContext } from '../../common/tenant/tenant-context.service.js';
import { CajaService } from '../../modules/comercial/services/caja.service.js';
import { ComprasService } from '../../modules/comercial/services/compras.service.js';
import { DevolucionesService } from '../../modules/comercial/services/devoluciones.service.js';
import { VentasService } from '../../modules/comercial/services/ventas.service.js';
import { CarritoService } from '../../modules/electronico/services/carrito.service.js';
import { CheckoutService } from '../../modules/electronico/services/checkout.service.js';
import { ReservasService } from '../../modules/electronico/services/reservas.service.js';
import { AlmacenesService } from '../../modules/inventario/services/almacenes.service.js';
import { InventarioService } from '../../modules/inventario/services/inventario.service.js';
import { ProductosService } from '../../modules/inventario/services/productos.service.js';
import { ProveedoresService } from '../../modules/inventario/services/proveedores.service.js';
import { TransferenciasService } from '../../modules/inventario/services/transferencias.service.js';
import { ClientesService } from '../../modules/operaciones/services/clientes.service.js';
import { EmpleadosService } from '../../modules/operaciones/services/empleados.service.js';
import { SucursalesService } from '../../modules/operaciones/services/sucursales.service.js';
import { AprovisionamientoService } from '../../modules/plataforma/services/aprovisionamiento.service.js';
import { HistoricoDemoService } from './historico/historico-demo.service.js';

/**
 * npm run seed:historico -- [--slug=demo-bi] [--meses=12] [--ventas-dia=6] [--semilla=20261107]
 *
 * Crea una empresa de demostracion con meses de operacion para probar el BI. Solo en desarrollo.
 */
if (process.env.NODE_ENV === 'production') {
  console.error('seed:historico no corre en produccion.');
  process.exit(1);
}

function argumento(nombre: string, porDefecto: string): string {
  const prefijo = `--${nombre}=`;
  return process.argv.find((arg) => arg.startsWith(prefijo))?.slice(prefijo.length) ?? porDefecto;
}

const opciones = {
  slug: argumento('slug', 'demo-bi'),
  meses: Number(argumento('meses', '12')),
  ventasPorDia: Number(argumento('ventas-dia', '6')),
  semilla: Number(argumento('semilla', '20261107')),
};
if (!/^[a-z0-9-]{3,40}$/.test(opciones.slug) || !(opciones.meses >= 1 && opciones.meses <= 36) || !(opciones.ventasPorDia > 0)) {
  console.error('Argumentos invalidos: --slug (a-z, 0-9, -), --meses entre 1 y 36, --ventas-dia > 0');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
const servicio = <T>(tipo: new (...args: never[]) => T): T => app.get(tipo, { strict: false });
// El vencimiento automatico de reservas revisa todas las empresas: mientras el reloj esta simulado no debe correr.
servicio(ReservasService).onModuleDestroy();

const generador = new HistoricoDemoService(
  servicio(DataSource),
  servicio(TenantContext),
  servicio(AprovisionamientoService),
  servicio(SucursalesService),
  servicio(AlmacenesService),
  servicio(ProveedoresService),
  servicio(ProductosService),
  servicio(EmpleadosService),
  servicio(ClientesService),
  servicio(CajaService),
  servicio(ComprasService),
  servicio(VentasService),
  servicio(ReservasService),
  servicio(DevolucionesService),
  servicio(CarritoService),
  servicio(CheckoutService),
  servicio(InventarioService),
  servicio(TransferenciasService),
);

const inicio = Date.now();
try {
  const resumen = await generador.generar(opciones);
  console.log('\nHistoria generada:', JSON.stringify({ ...resumen, segundos: Math.round((Date.now() - inicio) / 1000) }, null, 2));
  console.log(`\nEntra a la tienda /t/${resumen.slug} con ${resumen.adminEmail} / ${resumen.adminPassword}`);
} finally {
  await app.close();
}
