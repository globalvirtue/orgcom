import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const recipients = pgTable('recipients', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }),
    languagePreference: varchar('language_preference', { length: 10 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const recipientGroups = pgTable('recipient_groups', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recipientGroupMembers = pgTable('recipient_group_members', {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id').notNull().references(() => recipients.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => recipientGroups.id, { onDelete: 'cascade' }),
}, (table) => ({
    uniqueMember: uniqueIndex('unique_member_idx').on(table.recipientId, table.groupId),
}));
