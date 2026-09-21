export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
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
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
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
  },
});
