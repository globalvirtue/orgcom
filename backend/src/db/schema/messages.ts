import { pgTable, uuid, text, varchar, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { campaigns } from './campaigns';
import { users } from './users';
import { recipients } from './recipients';
import { recipientGroups } from './recipients';

export const messageStatusEnum = pgEnum('message_status', ['draft', 'scheduled', 'sending', 'completed']);
export const messageTypeEnum = pgEnum('message_type', ['sms', 'voice']);
export const audioSourceEnum = pgEnum('audio_source', ['upload', 'record', 'tts']);

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
    type: messageTypeEnum('type').notNull().default('voice'),

    // Content
    sourceText: text('source_text').notNull(),
    sourceLanguage: varchar('source_language', { length: 10 }).notNull(),
    targetLanguages: jsonb('target_languages').notNull().$type<string[]>(),
    translations: jsonb('translations').$type<Record<string, string>>(),

    // Voice Specific
    audioSource: audioSourceEnum('audio_source').default('tts'),
    audioUrls: jsonb('audio_urls').$type<Record<string, string>>(),

    // SMS Specific
    smsBody: text('sms_body'),
    smsSegments: jsonb('sms_segments').$type<number>(),

    status: messageStatusEnum('status').notNull().default('draft'),
    scheduledAt: timestamp('scheduled_at'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messageRecipients = pgTable('message_recipients', {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').notNull().references(() => recipients.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => recipientGroups.id, { onDelete: 'set null' }),
});
