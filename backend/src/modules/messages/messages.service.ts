import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { messages, messageRecipients, recipients, recipientGroupMembers, organizations } from '../../db/schema/index.js';
import { translateService } from '../../services/translate.js';
import { ttsService } from '../../services/tts.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import type { CreateMessageInput, UpdateMessageInput } from './messages.schemas.js';

export class MessagesService {
    async create(orgId: string, userId: string, input: CreateMessageInput) {
        // Create message in draft status
        const [message] = await db.insert(messages).values({
            orgId,
            sourceText: input.sourceText,
            sourceLanguage: input.sourceLanguage,
            targetLanguages: input.targetLanguages,
            campaignId: input.campaignId || null,
            status: 'draft',
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            createdBy: userId,
        }).returning();

        // Add recipients if provided
        if (input.recipientIds && input.recipientIds.length > 0) {
            await this.addRecipients(message.id, input.recipientIds);
        }

        // Resolve group members and add them too
        if (input.groupIds && input.groupIds.length > 0) {
            await this.addRecipientsFromGroups(message.id, input.groupIds);
        }

        return message;
    }

    async list(orgId: string) {
        return db.select().from(messages).where(eq(messages.orgId, orgId));
    }

    async getById(orgId: string, id: string) {
        const [m] = await db.select().from(messages)
            .where(and(eq(messages.id, id), eq(messages.orgId, orgId)));
        if (!m) throw new AppError(404, 'Message not found');
        return m;
    }

    async update(orgId: string, id: string, input: UpdateMessageInput) {
        const existing = await this.getById(orgId, id);
        if (existing.status !== 'draft') {
            throw new AppError(400, 'Only draft messages can be edited');
        }

        const [m] = await db.update(messages)
            .set({
                ...input,
                // Reset translations/audio if text or languages changed
                translations: input.sourceText || input.targetLanguages ? null : existing.translations,
                audioUrls: input.sourceText || input.targetLanguages ? null : existing.audioUrls,
                updatedAt: new Date(),
            })
            .where(and(eq(messages.id, id), eq(messages.orgId, orgId)))
            .returning();
        return m;
    }

    async delete(orgId: string, id: string) {
        const [m] = await db.delete(messages)
            .where(and(eq(messages.id, id), eq(messages.orgId, orgId)))
            .returning();
        if (!m) throw new AppError(404, 'Message not found');
        return m;
    }

    async translate(orgId: string, id: string) {
        const message = await this.getById(orgId, id);

        logger.info(`Translating message ${id} from ${message.sourceLanguage} to ${(message.targetLanguages as string[]).join(', ')}`);

        const translations = await translateService.translateBatch(
            message.sourceText,
            message.targetLanguages as string[],
            message.sourceLanguage
        );

        const [updated] = await db.update(messages)
            .set({ translations, updatedAt: new Date() })
            .where(eq(messages.id, id))
            .returning();

        return updated;
    }

    async generateAudio(orgId: string, id: string) {
        const message = await this.getById(orgId, id);

        if (!message.translations) {
            throw new AppError(400, 'Message must be translated before generating audio');
        }

        logger.info(`Generating audio for message ${id}`);

        const audioUrls = await ttsService.generateBatchAudio(
            message.translations as Record<string, string>,
            id
        );

        const [updated] = await db.update(messages)
            .set({ audioUrls, updatedAt: new Date() })
            .where(eq(messages.id, id))
            .returning();

        return updated;
    }

    async getRecipients(orgId: string, messageId: string) {
        await this.getById(orgId, messageId);

        return db.select({
            id: recipients.id,
            phone: recipients.phone,
            name: recipients.name,
            languagePreference: recipients.languagePreference,
        })
            .from(messageRecipients)
            .innerJoin(recipients, eq(messageRecipients.recipientId, recipients.id))
            .where(eq(messageRecipients.messageId, messageId));
    }

    async resolveRecipientLanguage(recipientId: string, orgId: string): Promise<string> {
        const [recipient] = await db.select().from(recipients).where(eq(recipients.id, recipientId));
        if (recipient?.languagePreference) {
            return recipient.languagePreference;
        }

        // Fallback to org default language
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        logger.info(`Using org default language fallback for recipient ${recipientId}`);
        return org.defaultLanguage;
    }

    private async addRecipients(messageId: string, recipientIds: string[]) {
        const values = recipientIds.map((rid) => ({
            messageId,
            recipientId: rid,
        }));
        await db.insert(messageRecipients).values(values);
    }

    private async addRecipientsFromGroups(messageId: string, groupIds: string[]) {
        const members = await db.select({ recipientId: recipientGroupMembers.recipientId, groupId: recipientGroupMembers.groupId })
            .from(recipientGroupMembers)
            .where(inArray(recipientGroupMembers.groupId, groupIds));

        if (members.length > 0) {
            const values = members.map((m) => ({
                messageId,
                recipientId: m.recipientId,
                groupId: m.groupId,
            }));
            await db.insert(messageRecipients).values(values);
        }
    }
}

export const messagesService = new MessagesService();
