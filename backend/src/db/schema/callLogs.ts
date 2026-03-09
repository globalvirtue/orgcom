import { pgTable, uuid, varchar, integer, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { messages } from './messages';
import { campaigns } from './campaigns';
import { recipients } from './recipients';

export const callStatusEnum = pgEnum('call_status', ['pending', 'queued', 'answered', 'not_answered', 'failed']);

export const callLogs = pgTable('call_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    recipientId: uuid('recipient_id').notNull().references(() => recipients.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 20 }).notNull(),
    languageUsed: varchar('language_used', { length: 10 }).notNull(),
    status: callStatusEnum('status').notNull().default('pending'),
    durationSeconds: integer('duration_seconds').default(0),
    cost: decimal('cost', { precision: 10, scale: 4 }).default('0'),
    retryCount: integer('retry_count').default(0),
    providerId: varchar('provider_id', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
