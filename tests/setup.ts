import 'dotenv/config';

/**
 * テストは必ず専用 DB に対して実行する。
 * 開発 DB (`DATABASE_URL`) を誤って破壊しないよう、ここで必ず上書きする。
 */
const TEST_DB_FALLBACK = 'postgresql://postgres:postgres@127.0.0.1:5432/virtue_test?schema=public';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? TEST_DB_FALLBACK;
