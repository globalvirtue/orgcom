import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { messages, messageRecipients, recipients, wallets, transactions, organizations } from '../../db/schema/index.js';
import { messagesService } from '../messages/messages.service.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';

export class SmsService {
    async sendMessage(orgId: string, messageId: string) {
        const message = await messagesService.getById(orgId, messageId);

        if (message.type !== 'sms') {
            throw new AppError(400, 'Message type is not SMS');
        }

        const msgRecipients = await messagesService.getRecipients(orgId, messageId);

        // Calculate total segments and cost
        // Standard SMS is 160 chars. Let's assume 1 segment for now or calculate properly if needed.
        const body = message.smsBody || message.sourceText;
        const segments = Math.ceil(body.length / 160) || 1;
        const totalEstimatedCost = msgRecipients.length * segments * config.pricePerSms;

        // Check wallet balance
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        if (parseFloat(wallet.balance) < totalEstimatedCost) {
            throw new AppError(402, `Insufficient balance. Required: ₦${totalEstimatedCost}, Available: ₦${parseFloat(wallet.balance)}`);
        }

        // Update message status to sending
        await db.update(messages).set({
            status: 'sending',
            smsSegments: segments,
            updatedAt: new Date()
        }).where(eq(messages.id, messageId));

        logger.info(`Sending SMS message ${messageId} (${segments} segments) to ${msgRecipients.length} recipients`);

        // Simulate sending (mock for now as Africa's Talking SMS isn't fully configured in this context)
        // In a real scenario, we'd use AT SDK here similar to VoiceService.

        for (const recipient of msgRecipients) {
            logger.info(`[MOCK SMS] To: ${recipient.phone}, Body: ${body}`);
            // Deduct cost and record transaction
            await this.deductSmsCost(orgId, messageId, recipient.phone, segments);
        }

        // Update status to completed
        await db.update(messages).set({
            status: 'completed',
            updatedAt: new Date()
        }).where(eq(messages.id, messageId));

        return { sent: msgRecipients.length, totalCost: totalEstimatedCost };
    }

    private async deductSmsCost(orgId: string, messageId: string, phone: string, segments: number) {
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        if (!wallet) return;

        const cost = segments * config.pricePerSms;
        const newBalance = parseFloat(wallet.balance) - cost;

        await db.update(wallets).set({
            balance: String(Math.max(0, newBalance)),
            updatedAt: new Date(),
        }).where(eq(wallets.id, wallet.id));

        await db.insert(transactions).values({
            orgId,
            walletId: wallet.id,
            type: 'debit',
            amount: String(cost),
            description: `SMS charge to ${phone} (${segments} segments)`,
            reference: messageId,
        });
    }
}

export const smsService = new SmsService();
