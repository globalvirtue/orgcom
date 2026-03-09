import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb, decimal } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'scheduled', 'sending', 'completed', 'cancelled']);
export const campaignTypeEnum = pgEnum('campaign_type', ['sms', 'voice']);
export const campaignModeEnum = pgEnum('campaign_mode', ['one_time', 'scheduled', 'recurring']);
export const recurringIntervalEnum = pgEnum('recurring_interval', ['daily', 'weekly', 'monthly']);

export const campaigns = pgTable('campaigns', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: campaignTypeEnum('type').notNull().default('voice'),
    mode: campaignModeEnum('mode').notNull().default('one_time'),
    status: campaignStatusEnum('status').notNull().default('draft'),

    // Audience
    audience: jsonb('audience').notNull().default({}), // { groupIds: [], recipientIds: [], all: boolean }

    // Scheduling
    scheduledAt: timestamp('scheduled_at'),
    recurringInterval: recurringIntervalEnum('recurring_interval'),
    recurringEndDate: timestamp('recurring_end_date'),
    nextRunDate: timestamp('next_run_date'),

    // Stats & Cost
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }).default('0'),
    metadata: jsonb('metadata').default({}), // Stats like deliveryRate, totalSent etc.

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
