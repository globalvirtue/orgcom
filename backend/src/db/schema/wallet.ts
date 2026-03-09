import { pgTable, uuid, decimal, timestamp, varchar, text, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const wallets = pgTable('wallets', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
    balance: decimal('balance', { precision: 12, scale: 4 }).notNull().default('0'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionTypeEnum = pgEnum('transaction_type', ['credit', 'debit']);

export const transactions = pgTable('transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    walletId: uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    amount: decimal('amount', { precision: 12, scale: 4 }).notNull(),
    description: text('description'),
    reference: varchar('reference', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
