export default () => ({
  port: parseInt(process.env.PORT || '3333', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'koki-super-secret-jwt-key-2026-production-ready',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  saas: {
    productId: process.env.SAAS_PRODUCT_ID || 'koki',
    productName: process.env.SAAS_PRODUCT_NAME || 'Koki',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
});
