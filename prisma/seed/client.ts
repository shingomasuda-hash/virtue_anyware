import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL が設定されていません。');

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
