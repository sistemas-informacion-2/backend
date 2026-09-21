export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  /** URL publica del frontend: PayPal redirige aqui al terminar el pago. */
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
  paypal: {
    mode: 'sandbox' | 'live';
    clientId: string;
    clientSecret: string;
    /** Moneda en la que PayPal cobra (no opera BOB). */
    currency: string;
    /** Bolivianos por cada unidad de `currency`. */
    bobRate: number;
  };
}

const paypalMode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';

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
  paypal: {
    mode: paypalMode,
    clientId: (paypalMode === 'live' ? process.env.PAYPAL_LIVE_CLIENT_ID : process.env.PAYPAL_SANDBOX_CLIENT_ID) ?? '',
    clientSecret: (paypalMode === 'live' ? process.env.PAYPAL_LIVE_CLIENT_SECRET : process.env.PAYPAL_SANDBOX_CLIENT_SECRET) ?? '',
    currency: process.env.PAYPAL_CURRENCY ?? 'USD',
    bobRate: Number(process.env.PAYPAL_BOB_USD_RATE) || 6.96,
  },
});
