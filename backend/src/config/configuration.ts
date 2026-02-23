export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  // ClickUp
  clickup: {
    clientId: process.env.CLICKUP_CLIENT_ID,
    clientSecret: process.env.CLICKUP_CLIENT_SECRET,
    redirectUri: process.env.CLICKUP_REDIRECT_URI,
  },

  // File Storage
  storage: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },

  // Rate Limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  },
});
