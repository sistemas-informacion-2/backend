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
  gemini: {
    /** API key de Google AI Studio (generativelanguage.googleapis.com). Vacio = reportes generativos caen al interprete por regex (CU18). */
    apiKey: string;
    model: string;
  };
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
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
  },
});
