import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { userRoleEnum } from './users';

export const invitations = pgTable('invitations', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('campaign_manager'),
    token: varchar('token', { length: 255 }).notNull().unique(),
    used: boolean('used').notNull().default(false),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
