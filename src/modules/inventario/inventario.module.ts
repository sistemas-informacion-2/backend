import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../operaciones/entities/sucursal.entity.js';
import { Categoria } from './entities/categoria.entity.js';
import { Proveedor } from './entities/proveedor.entity.js';
import { Temporada } from './entities/temporada.entity.js';
import { TemporadaCategoria } from './entities/temporada-categoria.entity.js';
import { Producto } from './entities/producto.entity.js';
import { ImagenProducto } from './entities/imagen-producto.entity.js';
import { VarianteProducto } from './entities/variante-producto.entity.js';
import { CategoriasController } from './controllers/categorias.controller.js';
import { ProveedoresController } from './controllers/proveedores.controller.js';
import { TemporadasController } from './controllers/temporadas.controller.js';
import { ProductosController } from './controllers/productos.controller.js';
import { CategoriasService } from './services/categorias.service.js';
import { ProveedoresService } from './services/proveedores.service.js';
import { TemporadasService } from './services/temporadas.service.js';
import { ProductosService } from './services/productos.service.js';
import { CategoriaRepository } from './repositories/categoria.repository.js';
import { ProveedorRepository } from './repositories/proveedor.repository.js';
import { TemporadaRepository } from './repositories/temporada.repository.js';
import { TemporadaCategoriaRepository } from './repositories/temporada-categoria.repository.js';
import { ProductoRepository } from './repositories/producto.repository.js';
import { ImagenProductoRepository } from './repositories/imagen-producto.repository.js';
import { VarianteProductoRepository } from './repositories/variante-producto.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Categoria,
      Proveedor,
      Temporada,
      TemporadaCategoria,
      Producto,
      ImagenProducto,
      VarianteProducto,
      Sucursal,
    ]),
  ],
  controllers: [CategoriasController, ProveedoresController, TemporadasController, ProductosController],
  providers: [
    CategoriasService,
    ProveedoresService,
    TemporadasService,
    ProductosService,
    CategoriaRepository,
    ProveedorRepository,
    TemporadaRepository,
    TemporadaCategoriaRepository,
    ProductoRepository,
    ImagenProductoRepository,
    VarianteProductoRepository,
  ],
  exports: [TypeOrmModule],
})
export class InventarioModule {}
