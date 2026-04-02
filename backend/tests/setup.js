process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-chars-long!!';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'file:./prisma/test.db';
process.env.LLM_MOCK = '1';
process.env.TELEGRAM_BOT_TOKEN = '';
