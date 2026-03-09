import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';
import { config } from '../config/env.js';

let db: any;

if (config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1')) {
    const pool = new pg.Pool({ connectionString: config.databaseUrl });
    db = drizzlePg(pool, { schema });
} else {
    const sql = neon(config.databaseUrl);
    db = drizzle(sql, { schema });
}

export { db };
