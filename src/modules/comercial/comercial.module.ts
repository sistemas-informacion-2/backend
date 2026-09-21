import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../operaciones/entities/sucursal.entity.js';
import { EmpleadoSucursal } from '../operaciones/entities/empleado-sucursal.entity.js';
import { Proveedor } from '../inventario/entities/proveedor.entity.js';
import { Almacen } from '../inventario/entities/almacen.entity.js';
import { VarianteProducto } from '../inventario/entities/variante-producto.entity.js';
import { ProductoSucursal } from '../inventario/entities/producto-sucursal.entity.js';
import { Inventario } from '../inventario/entities/inventario.entity.js';
import { NotaCompra } from './entities/nota-compra.entity.js';
import { DetalleNotaCompra } from './entities/detalle-nota-compra.entity.js';
import { PasarelaPago } from './entities/pasarela-pago.entity.js';
import { Caja } from './entities/caja.entity.js';
import { MovimientoCaja } from './entities/movimiento-caja.entity.js';
import { PasarelaRepository } from './repositories/pasarela.repository.js';
import { CajaRepository } from './repositories/caja.repository.js';
import { MovimientoCajaRepository } from './repositories/movimiento-caja.repository.js';
import { PasarelasService } from './services/pasarelas.service.js';
import { CajaService } from './services/caja.service.js';
import { ComprasService } from './services/compras.service.js';
import { CompraRepository } from './repositories/compra.repository.js';
import { ComprasController } from './controllers/compras.controller.js';
import { PasarelasController } from './controllers/pasarelas.controller.js';
import { CajasController } from './controllers/cajas.controller.js';
import { PasarelaSeederService } from './seeders/pasarela-seeder.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([
      PasarelaPago,
      Caja,
      MovimientoCaja,
      Sucursal,
      EmpleadoSucursal,
      NotaCompra,
      DetalleNotaCompra,
      Proveedor,
      Almacen,
      VarianteProducto,
      ProductoSucursal,
      Inventario,
    ])],
  controllers: [PasarelasController, CajasController, ComprasController],
  providers: [
    PasarelasService,
    PasarelaRepository,
    PasarelaSeederService,
    CajaService,
    CajaRepository,
    MovimientoCajaRepository,
    ComprasService,
    CompraRepository,
  ],
  exports: [TypeOrmModule, PasarelaSeederService],
})
export class ComercialModule {}
