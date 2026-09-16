1. Configuración del Proyecto y Tecnologías Core
Stack Tecnológico:
Entorno: Node.js (v20+ LTS) con TypeScript.

Framework Backend: NestJS v10+.

Persistencia / ORM: Prisma ORM (o TypeORM) conectado a PostgreSQL.

Autenticación / Seguridad: @nestjs/jwt, @nestjs/passport, bcrypt.

Validación: class-validator, class-transformer.

Cache & Eventos: ioredis / @nestjs/microservices (Pub/Sub para WebSockets).

Comunicación Real-time: @nestjs/websockets, @nestjs/platform-socket.io (Gateway STOMP/Socket.io).

Documentación: @nestjs/swagger (OpenAPI).

Almacenamiento: AWS SDK / Google Cloud Storage / Local Multer.

2. Configuración Externa e Inyección de Entorno
Se gestiona mediante @nestjs/config cargando archivos .env y validándolos fuertemente mediante joi o zod:

Plaintext
PORT=3000
DATABASE_URL="postgresql://user:pass@localhost:5432/tienda_db?schema=public"
JWT_SECRET=super_secret_key
JWT_EXPIRATION=8h
REDIS_URL=redis://localhost:6379
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
3. Arquitectura de Paquetes Modulares
A diferencia de una arquitectura por capas globales (controllers/, services/, entities/), NestJS promueve la encapsulación por módulos de dominio. Cada paquete dentro de src/modules/ es autosuficiente y registra sus propios controladores, servicios y repositorios.

Plaintext
src/modules/modulo_x/
├── dto/                    # Data Transfer Objects (Request / Response)
│   ├── create-x.dto.ts
│   ├── update-x.dto.ts
│   └── x-response.dto.ts
├── entities/               # Entidades de dominio o Schema Prisma
│   └── x.entity.ts
├── controllers/            # Controladores HTTP (Endpoints)
│   └── x.controller.ts
├── services/               # Lógica de Negocio
│   └── x.service.ts
├── repositories/          # Acceso a Datos (Patrón Repository)
│   └── x.repository.ts
├── mappers/                # Transformación Entidad <-> DTO
│   └── x.mapper.ts
└── modulo_x.module.ts      # Definición e Inyección de Dependencias

4. Módulos de Negocio
4.1. AccesoModule (src/modules/acceso)
Propósito: Seguridad funcional, autenticación de actores y auditoría.

Componentes: AuthService, UsersService, RolesService, AuditService.

Entidades: Usuario, Empleado, Cliente, Rol, Permiso, LogAuditoria, Sesion.

4.2. InventarioModule (src/modules/inventario)
Propósito: Gestión de stock, insumos, lotes y recetas.

Componentes: InventarioService, LoteService, RecetaService.

Relaciones: Se conecta con ComercialModule y OperacionesModule para descontar inventario en tiempo real.

4.3. ComercialModule (src/modules/comercial)
Propósito: Operaciones comerciales administrativas, productos finales, caja y ventas presenciales.

Componentes: ProductoService, CategoriaService, CompraService, VentaService, CajaService.

4.4. ElectronicoModule (src/modules/electronico)
Propósito: E-commerce público, catálogo digital, carrito de compras y pasarelas de pago.

Componentes: CatalogoService, CarritoService, PasarelaPagoService (PayPal, Stripe).

4.5. OperacionesModule (src/modules/operaciones)
Propósito: Estructura física, sucursales, comandas y asignación de personal.

Componentes: SucursalService, ComandaService, MesaService, OperacionesGateway (WebSockets).

5. Capas Internas de un Módulo NestJS
5.1. Controller (*.controller.ts)
Responsable exclusivamente de recibir solicitudes HTTP, mapear parámetros, validar el body mediante DTOs, validar permisos con Guards y retornar respuestas HTTP.

TypeScript
@ApiTags('Inventario')
@Controller('api/inventario')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post()
  @RequirePermission('inventario:create')
  async crear(@Body() dto: CreateInventarioDto): Promise<InventarioResponseDto> {
    return this.inventarioService.crear(dto);
  }
}
5.2. DTO (*.dto.ts)
Clases TypeScript decoradas con class-validator para garantizar la integridad de los datos entrantes.

TypeScript
export class CreateInventarioDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(UnidadMedidaEnum)
  unidadMedida: UnidadMedidaEnum;
}
5.3. Service (*.service.ts)
Contiene la Lógica de Negocio pura. Reglas de validación, orquestación de repositorios, manejo de transacciones de base de datos y emisión de auditorías.

TypeScript
@Injectable()
export class InventarioService {
  constructor(
    private readonly inventarioRepository: InventarioRepository,
    private readonly mapper: InventarioMapper,
    private readonly auditService: AuditService,
  ) {}

  async crear(dto: CreateInventarioDto): Promise<InventarioResponseDto> {
    const existe = await this.inventarioRepository.findByCodigo(dto.codigo);
    if (existe) throw new BadRequestException('El código ya existe');

    const entity = this.mapper.toEntity(dto);
    const guardado = await this.inventarioRepository.save(entity);
    
    await this.auditService.log('inventario', 'CREATE', guardado.id);
    return this.mapper.toResponseDto(guardado);
  }
}
5.4. Repository (*.repository.ts)
Aísla las consultas de la base de datos (usando Prisma Client o TypeORM). Evita acoplar el ORM directamente en la capa de servicios.

5.5. Mapper (*.mapper.ts)
Transforma entidades JPA/Prisma a DTOs de respuesta, filtrando datos sensibles (contraseñas, datos internos) antes de enviarlos al frontend.

6. Flujo Completo de una Petición REST en NestJS
Plaintext
Cliente (HTTP Request: POST /api/inventario)
  │
  ▼
[ Global Middlewares / CORS ]
  │
  ▼
[ JwtAuthGuard ] ──► (Valida el Token JWT y extrae al Usuario Activo)
  │
  ▼
[ PermissionsGuard ] ──► (Verifica que el usuario tenga 'inventario:create')
  │
  ▼
[ ValidationPipe ] ──► (Valida y transforma el CreateInventarioDto con class-validator)
  │
  ▼
[ InventarioController ]
  │
  ▼
[ InventarioService ] ──► (Ejecuta reglas de negocio y transacciones)
  │
  ▼
[ InventarioRepository ] ──► [ Prisma / PostgreSQL Database ]
  │
  ▼
[ InventarioMapper ] ──► (Convierte Entidad DB a InventarioResponseDto)
  │
  ▼
[ ResponseInterceptor ] ──► (Formatea la respuesta HTTP JSON unificada)
  │
  ▼
Cliente (HTTP Response 201 Created)
Manejo de Excepciones:
Si ocurre un error en cualquier punto del flujo, el AllExceptionsFilter global intercepta la excepción y retorna una estructura estándar:

JSON
{
  "statusCode": 400,
  "message": ["El código de inventario ya está registrado"],
  "error": "Bad Request",
  "timestamp": "2026-09-16T08:16:38.000Z",
  "path": "/api/inventario"
}
7. Seguridad, Autenticación y Autorización
Passport JWT Strategy (jwt.strategy.ts): Decodifica el token Bearer del header Authorization o de las cookies, valida la firma y adjunta el payload compilado (req.user) a la petición.

Decorador Custom @RequirePermission('permiso'): Asigna los permisos requeridos para acceder a una ruta determinada.

PermissionsGuard (permissions.guard.ts): Compara los permisos contenidos en el token JWT del usuario contra los declarados en la ruta usando Reflector de NestJS.

8. WebSockets y Estado Temporal (Redis Pub/Sub)
Gateways (@WebSocketGateway): Proveen salas de chat, notificaciones en vivo de pedidos y alertas de cocina por sucursal (/topic/sucursal/1/comandas).

Redis Pub/Sub Adapter: Si la aplicación escala a múltiples instancias Node.js, Redis distribuye los eventos emitidos por WebSockets a todos los nodos conectados.

9. Reglas Arquitectónicas para Desarrollo Futuro (Guía para IA / Devs)
Modularidad Estricta: Toda nueva entidad/recurso debe alojarse dentro de su correspondiente módulo de dominio (modules/<dominio>/).

Encapsulamiento en DTOs: Queda estrictamente prohibido retornar modelos o entidades ORM directas en los controladores. Siempre utilizar DTOs de respuesta.

Inyección de Dependencias: Usar siempre los decoradores @Injectable() y resolver repositorios y servicios a través de constructores.

Validación Declarativa: Todo DTO de entrada debe estar tipado y validado mediante decoradores de class-validator.

Soft Delete (Borrado Lógico): En las entidades JPA/Prisma, usar la bandera activo: boolean para desactivar registros en lugar de destruirlos físicamente (DELETE).

Manejo Transaccional: Toda operación service que afecte a más de 2 tablas debe encapsularse en una transacción (prisma.$transaction).

Documentación Swagger: Decorar cada controlador y DTO con anotaciones de @nestjs/swagger (@ApiTags, @ApiOperation, @ApiResponse).