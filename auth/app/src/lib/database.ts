import { Pool } from 'pg';
import { env } from './env';

export const database = new Pool({ connectionString: env.databaseUrl, max: 5 });
