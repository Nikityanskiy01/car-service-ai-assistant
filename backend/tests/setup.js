process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-chars-long!!';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://car_service_app:change-me@localhost:5433/car_service_test';
process.env.TELEGRAM_BOT_TOKEN = '';
