import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    defaultLanguage: varchar('default_language', { length: 10 }).notNull().default('en'),
    timezone: varchar('timezone', { length: 100 }).notNull().default('Africa/Lagos'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
