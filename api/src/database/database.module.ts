import { Global, Module } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE = Symbol('DATABASE');
export type Database = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var __pgPool: Pool | undefined;
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error('DATABASE_URL is required.');
        }

        // Reuse a global pool to avoid exhausting connections in serverless environments
        const pool = (global as any).__pgPool ?? new Pool({ connectionString });
        if (!(global as any).__pgPool) (global as any).__pgPool = pool;

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
