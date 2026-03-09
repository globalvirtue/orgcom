import fs from 'fs';
import path from 'path';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { campaigns, messages, messageRecipients, recipientGroupMembers, recipients } from '../../db/schema/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { CreateCampaignInput, UpdateCampaignInput } from './campaigns.schemas.js';

export class CampaignsService {
    async create(orgId: string, userId: string, input: CreateCampaignInput) {
        return await db.transaction(async (tx: any) => {
            const now = new Date();
            const isSendNow = input.mode === 'one_time' && !input.scheduledAt;
            const finalScheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : (isSendNow ? now : null);
            const initialStatus = isSendNow ? 'scheduled' : (input.scheduledAt ? 'scheduled' : 'draft');

            // 1. Create Campaign
            const [campaign] = await tx.insert(campaigns).values({
                orgId,
                name: input.name,
                description: input.description || null,
                type: input.type,
                mode: input.mode,
                status: initialStatus,
                audience: input.audience as any,
                scheduledAt: finalScheduledAt,
                recurringInterval: input.recurringInterval || null,
                recurringEndDate: input.recurringEndDate ? new Date(input.recurringEndDate) : null,
            }).returning();

            // 2. Process Audio if provided as base64/blob
            let audioUrl = input.messageContent.audioUrl;
            if (audioUrl && audioUrl.startsWith('data:')) {
                const [header, base64Data] = audioUrl.split(';base64,');
                const extension = header.split('/')[1] || 'mp3';
                const filename = `upload_${campaign.id}_${Date.now()}.${extension}`;
                const filePath = path.join(config.audioStoragePath, filename);

                // Ensure directory exists
                if (!fs.existsSync(config.audioStoragePath)) {
                    fs.mkdirSync(config.audioStoragePath, { recursive: true });
                }

                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                audioUrl = `/api/audio/${filename}`;
                logger.info(`Persisted uploaded audio: ${filename}`);
            }

            const audioUrls = audioUrl
                ? { [input.messageContent.sourceLanguage || 'en']: audioUrl }
                : null;

            const [message] = await tx.insert(messages).values({
                orgId,
                campaignId: campaign.id,
                type: input.type,
                sourceText: input.messageContent.sourceText,
                sourceLanguage: input.messageContent.sourceLanguage || 'en',
                targetLanguages: input.messageContent.targetLanguages,
                audioSource: input.messageContent.audioSource || 'tts',
                audioUrls,
                smsBody: input.messageContent.smsBody || null,
                createdBy: userId,
                status: initialStatus === 'scheduled' ? 'scheduled' : 'draft',
            }).returning();

            // 3. Resolve Audience and Link to Message
            const recipientIds = await this.resolveAudience(orgId, input.audience);
            if (recipientIds.length > 0) {
                const recipientValues = recipientIds.map(rid => ({
                    messageId: message.id,
                    recipientId: rid,
                }));
                // Chunk insertion if needed for very large lists
                await tx.insert(messageRecipients).values(recipientValues);
            }

            logger.info(`Campaign created: ${campaign.name} (${campaign.id}) with ${recipientIds.length} recipients`);
            return { ...campaign, messageId: message.id, recipientCount: recipientIds.length };
        });
    }

    private async resolveAudience(orgId: string, audience: CreateCampaignInput['audience']): Promise<string[]> {
        const uniqueIds = new Set<string>();

        if (audience.all) {
            const allRecipients = await db.select({ id: recipients.id }).from(recipients).where(eq(recipients.orgId, orgId));
            allRecipients.forEach((r: any) => uniqueIds.add(r.id));
        } else {
            if (audience.recipientIds && audience.recipientIds.length > 0) {
                audience.recipientIds.forEach((r: string) => uniqueIds.add(r));
            }

            if (audience.groupIds && audience.groupIds.length > 0) {
                const groupMembers = await db.select({ recipientId: recipientGroupMembers.recipientId })
                    .from(recipientGroupMembers)
                    .where(inArray(recipientGroupMembers.groupId, audience.groupIds));
                groupMembers.forEach((m: { recipientId: string }) => uniqueIds.add(m.recipientId));
            }

            if (audience.pastedPhones && audience.pastedPhones.length > 0) {
                const phones = [...new Set(audience.pastedPhones)];

                // 1. Find existing
                const existingRecipients = await db.select({ id: recipients.id, phone: recipients.phone })
                    .from(recipients)
                    .where(and(
                        eq(recipients.orgId, orgId),
                        inArray(recipients.phone, phones)
                    ));

                existingRecipients.forEach((r: any) => uniqueIds.add(r.id));

                // 2. Create missing
                const existingPhones = new Set(existingRecipients.map(r => r.phone));
                const missingPhones = phones.filter(p => !existingPhones.has(p));

                if (missingPhones.length > 0) {
                    const newRecipients = await db.insert(recipients).values(
                        missingPhones.map(phone => ({
                            orgId,
                            phone,
                            name: phone, // Default name to phone
                        }))
                    ).returning({ id: recipients.id });

                    newRecipients.forEach((r: any) => uniqueIds.add(r.id));
                }
            }
        }

        return Array.from(uniqueIds);
    }

    async list(orgId: string) {
        return db.select().from(campaigns).where(eq(campaigns.orgId, orgId));
    }

    async getById(orgId: string, id: string) {
        const [c] = await db.select().from(campaigns)
            .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)));
        if (!c) throw new AppError(404, 'Campaign not found');

        // Fetch messages for this campaign
        const campaignMessages = await db.select().from(messages).where(eq(messages.campaignId, id));

        return { ...c, messages: campaignMessages };
    }

    async update(orgId: string, id: string, input: UpdateCampaignInput) {
        const [c] = await db.update(campaigns)
            .set({ ...input, updatedAt: new Date() })
            .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
            .returning();
        if (!c) throw new AppError(404, 'Campaign not found');
        return c;
    }

    async delete(orgId: string, id: string) {
        const [c] = await db.delete(campaigns)
            .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
            .returning();
        if (!c) throw new AppError(404, 'Campaign not found');
        return c;
    }
}

export const campaignsService = new CampaignsService();
