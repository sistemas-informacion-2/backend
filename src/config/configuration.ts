export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  /** URL publica del frontend: Stripe redirige aqui al terminar el pago. */
  frontendUrl: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };
  jwt: {
    secret: string;
    accessExpiration: string;
    refreshExpiration: string;
  };
  seed: {
    adminEmail: string;
    adminPassword: string;
    /** Superadmin de la plataforma (SaaS); vacios = no se crea. */
    superadminEmail: string;
    superadminPassword: string;
  };
  payments: {
    encryptionKey: string;
    /** QR y tarjeta no tienen pasarela real: solo se ofrecen (aprobados en simulacion) si esto es true. */
    simulated: boolean;
  };
  stripe: {
    /** Llave secreta (`sk_test_...` en pruebas, `sk_live_...` en produccion). Vacia = Stripe desactivado. */
    secretKey: string;
    /** Moneda en la que Stripe cobra, en minusculas (`usd`). */
    currency: string;
    /** Bolivianos por cada unidad de `currency`. */
    bobRate: number;
  };
  push: {
    /** Si es false no se llama a Expo; las notificaciones solo se guardan en BD. */
    enabled: boolean;
    /** Access token de Expo; solo hace falta si se activa "enhanced security" para push en EAS. */
    accessToken: string;
  };
  tenant: {
    /**
     * Empresa que se usa cuando un request no trae X-Empresa ni token con empresa.
     * Mantiene funcionando a los clientes que todavia no mandan el header
     * (frontend y app movil anteriores al SaaS). Vacio = el header es obligatorio.
     */
    slugPorDefecto: string;
  };
  gemini: {
    /** API key de Google AI Studio (generativelanguage.googleapis.com). Vacio = reportes generativos caen al interprete por regex (CU18). */
    apiKey: string;
    model: string;
  };
  bi: {
    /**
     * Quien atiende al agente del BI: 'vertex' (Vertex AI en Google Cloud), 'api-key' (Google AI Studio, la misma
     * GEMINI_API_KEY de los reportes) o 'auto' = Vertex si hay proyecto de Google Cloud, si no la API key.
     */
    iaProveedor: 'auto' | 'vertex' | 'api-key';
    /** Modelo del agente. Por defecto el Flash-Lite mas barato que admite llamadas a herramientas. */
    modelo: string;
    /** Tope de preguntas al asistente por empresa en 24 horas: limita el gasto en Gemini. */
    preguntasPorDia: number;
    /** Proyecto y region de Vertex AI. Las credenciales salen de GOOGLE_APPLICATION_CREDENTIALS (ADC). */
    vertexProyecto: string;
    vertexRegion: string;
    /** Servicio de machine learning (Python) y la clave con que NestJS se identifica ante el. */
    mlUrl: string;
    mlClaveInterna: string;
    /** Carga nocturna del Data Warehouse. */
    etlProgramado: boolean;
    etlCron: string;
  };
}

function proveedorIa(valor: string | undefined): AppConfig['bi']['iaProveedor'] {
  const limpio = (valor ?? '').trim().toLowerCase();
  return limpio === 'vertex' || limpio === 'api-key' ? limpio : 'auto';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'ecommerce',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@fashionstore.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
    superadminEmail: (process.env.SEED_SUPERADMIN_EMAIL ?? '').trim().toLowerCase(),
    superadminPassword: process.env.SEED_SUPERADMIN_PASSWORD ?? '',
  },
  payments: {
    encryptionKey: process.env.PAGOS_ENCRYPTION_KEY ?? '',
    // Por defecto solo fuera de produccion: un pago simulado en produccion seria una compra gratis.
    simulated: process.env.PAGOS_SIMULADOS ? process.env.PAGOS_SIMULADOS === 'true' : (process.env.NODE_ENV ?? 'development') !== 'production',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() ?? '',
    currency: (process.env.STRIPE_CURRENCY ?? 'usd').toLowerCase(),
    bobRate: Number(process.env.STRIPE_BOB_RATE) || 6.96,
  },
  push: {
    enabled: process.env.PUSH_ENABLED !== 'false',
    accessToken: process.env.PUSH_ACCESS_TOKEN ?? '',
  },
  tenant: {
    slugPorDefecto: (process.env.TENANT_SLUG_POR_DEFECTO ?? 'fashionstore').trim().toLowerCase(),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
  },
  bi: {
    iaProveedor: proveedorIa(process.env.BI_IA_PROVEEDOR),
    modelo: (process.env.BI_GEMINI_MODEL ?? '').trim() || 'gemini-3.1-flash-lite',
    preguntasPorDia: Number(process.env.BI_PREGUNTAS_POR_DIA) || 200,
    vertexProyecto: (process.env.GOOGLE_CLOUD_PROJECT ?? '').trim(),
    vertexRegion: (process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1').trim(),
    mlUrl: (process.env.ML_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
    mlClaveInterna: process.env.ML_CLAVE_INTERNA ?? '',
    etlProgramado: process.env.BI_ETL_PROGRAMADO !== 'false',
    etlCron: (process.env.BI_ETL_CRON ?? '0 2 * * *').trim(),
  },
});
