import { createRequire } from 'module';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { callLogs, messages, messageRecipients, recipients, wallets, transactions, organizations } from '../../db/schema/index.js';
import { messagesService } from '../messages/messages.service.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';

const require = createRequire(import.meta.url);

export class VoiceService {
    private africastalking: any;
    private voice: any;

    constructor() {
        logger.info(`Initializing VoiceService with username: ${config.atUsername}`);
        if (config.atApiKey && config.atUsername) {
            try {
                // Africa's Talking SDK
                const AfricasTalking = require('africastalking');
                this.africastalking = AfricasTalking({
                    apiKey: config.atApiKey,
                    username: config.atUsername,
                });
                this.voice = this.africastalking.VOICE;
                logger.info('Africa\'s Talking SDK initialized successfully');
            } catch (err: any) {
                logger.error('Africa\'s Talking SDK initialization failed:', err);
                logger.warn('Voice calls will be mocked due to initialization error');
            }
        } else {
            logger.warn('Africa\'s Talking credentials missing — voice calls will be mocked');
        }
    }

    async sendMessage(orgId: string, messageId: string) {
        logger.info(`[VoiceService] sendMessage started for orgId=${orgId}, messageId=${messageId}`);
        const message = await messagesService.getById(orgId, messageId);

        if (!message.audioUrls || Object.keys(message.audioUrls).length === 0) {
            logger.warn(`[VoiceService] No audio URLs found for message ${messageId}`);
            throw new AppError(400, 'Message audio must be provided before sending a Voice Campaign');
        }

        // Check wallet balance
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        const msgRecipients = await messagesService.getRecipients(orgId, messageId);
        logger.info(`[VoiceService] Found ${msgRecipients.length} recipients for message ${messageId}`);

        const estimatedCost = msgRecipients.length * config.pricePerCall;
        if (parseFloat(wallet.balance) < estimatedCost) {
            logger.warn(`[VoiceService] Insufficient balance for message ${messageId}: required=${estimatedCost}, available=${wallet.balance}`);
            throw new AppError(402, `Insufficient balance. Required: ₦${estimatedCost.toLocaleString()}, Available: ₦${parseFloat(wallet.balance).toLocaleString()}`);
        }

        // Update message status to sending
        await db.update(messages).set({ status: 'sending', updatedAt: new Date() }).where(eq(messages.id, messageId));

        logger.info(`[VoiceService] Placing calls to ${msgRecipients.length} recipients...`);

        // Place calls for each recipient
        const audioUrls = message.audioUrls as Record<string, string>;

        for (const recipient of msgRecipients) {
            const language = await messagesService.resolveRecipientLanguage(recipient.id, orgId);
            const audioUrl = audioUrls[language] || audioUrls[message.sourceLanguage];

            logger.info(`[VoiceService] Placing call to ${recipient.phone} (language: ${language})`);
            await this.placeCall(orgId, messageId, message.campaignId, recipient, language, audioUrl);
        }

        logger.info(`[VoiceService] All calls placed for message ${messageId}`);
        return { sent: msgRecipients.length, estimatedCost };
    }

    async placeCall(
        orgId: string,
        messageId: string,
        campaignId: string | null,
        recipient: { id: string; phone: string },
        language: string,
        audioUrl: string
    ) {
        // Create call log
        const [callLog] = await db.insert(callLogs).values({
            orgId,
            messageId,
            campaignId,
            recipientId: recipient.id,
            phone: recipient.phone,
            languageUsed: language,
            status: 'pending',
            cost: String(config.pricePerCall),
        }).returning();

        if (this.voice) {
            try {
                const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${config.backendUrl}${audioUrl}`;

                // Ensure E.164 format (Simplified implementation for Nigeria)
                let formattedPhone = recipient.phone.trim();
                if (!formattedPhone.startsWith('+')) {
                    if (formattedPhone.startsWith('0')) {
                        formattedPhone = '+234' + formattedPhone.substring(1);
                    } else if (formattedPhone.length === 10) {
                        formattedPhone = '+234' + formattedPhone;
                    }
                }
                if (formattedPhone.length !== 14) { // +234 + 10 digits = 14
                    logger.warn(`[VoiceService] Phone number ${formattedPhone} may be invalid length (${formattedPhone.length})`);
                }

                logger.info(`[VoiceService] ATRALKING CALL: from=${config.atVoicePhone}, to=${formattedPhone}, requestId=${callLog.id}`);
                const result = await this.voice.call({
                    callFrom: config.atVoicePhone,
                    callTo: [formattedPhone],
                    clientRequestId: callLog.id,
                });
                logger.info(`[VoiceService] ATRALKING RESPONSE: ${JSON.stringify(result)}`);

                // Update with provider ID
                if (result?.entries?.[0]) {
                    const entry = result.entries[0];
                    logger.info(`[VoiceService] Call queued: sessionId=${entry.sessionId}, status=${entry.status}, errorMessage=${entry.errorMessage || 'none'}`);
                    await db.update(callLogs).set({
                        status: entry.status === 'Queued' ? 'queued' : 'failed',
                        providerId: entry.sessionId || null,
                        updatedAt: new Date(),
                    }).where(eq(callLogs.id, callLog.id));
                } else {
                    logger.warn(`[VoiceService] ATRALKING returned no entries for call to ${recipient.phone}`);
                }
            } catch (err: any) {
                const errorInfo = {
                    message: err.message,
                    stack: err.stack,
                    data: err.response?.data
                };
                logger.error(`[VoiceService] ATRALKING ERROR for ${recipient.phone}: ${JSON.stringify(errorInfo)}`);
                await db.update(callLogs).set({
                    status: 'failed',
                    updatedAt: new Date(),
                }).where(eq(callLogs.id, callLog.id));
            }
        } else {
            // Mock call for development
            logger.info(`[VoiceService] MOCK CALL: ${recipient.phone} with audio ${audioUrl}`);
            await db.update(callLogs).set({
                status: 'answered',
                durationSeconds: Math.floor(Math.random() * 30) + 5,
                providerId: `mock-${callLog.id}`,
                updatedAt: new Date(),
            }).where(eq(callLogs.id, callLog.id));

            // Deduct from wallet
            await this.deductCallCost(orgId, callLog.id);
        }

        return callLog;
    }

    async handleCallback(body: any): Promise<string | void> {
        logger.info(`[VoiceService] Voice callback raw body: ${JSON.stringify(body)}`);
        const { isActive, duration, callSessionState, direction, callerNumber, destinationNumber } = body;
        const sessionId = body.sessionId || body.callSessionId;

        logger.info(`[VoiceService] Processing callback: sessionId=${sessionId}, isActive=${isActive}, state=${callSessionState}`);

        if (!sessionId) {
            logger.warn('[VoiceService] Missing sessionId/callSessionId in callback');
            return;
        }

        // Find call log by provider ID
        const [callLog] = await db.select().from(callLogs).where(eq(callLogs.providerId, sessionId));
        if (!callLog) {
            logger.warn(`No call log found for sessionId: ${sessionId}`);
            return;
        }

        // Handle Active Call (Provide XML instructions to Africa's Talking)
        if (String(isActive) === '1') {
            const [message] = await db.select().from(messages).where(eq(messages.id, callLog.messageId));
            if (message) {
                const audioUrls = message.audioUrls as Record<string, string>;
                // Resolve correct language audio stream
                const audioUrl = audioUrls?.[callLog.languageUsed] || Object.values(audioUrls || {})[0];

                if (audioUrl) {
                    const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${config.backendUrl}${audioUrl}`;
                    logger.info(`Instructing AT to play audio: ${fullAudioUrl}`);
                    return `<?xml version="1.0" encoding="UTF-8"?><Response><Play url="${fullAudioUrl}"/></Response>`;
                }
            }
            logger.warn('No audio URL found for call, hanging up.');
            return `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`;
        }

        let status: 'answered' | 'not_answered' | 'failed' = 'failed';
        if (callSessionState === 'Completed' && parseInt(duration) > 0) {
            status = 'answered';
        } else if (callSessionState === 'Completed') {
            status = 'not_answered';
        }

        await db.update(callLogs).set({
            status,
            durationSeconds: parseInt(duration) || 0,
            updatedAt: new Date(),
        }).where(eq(callLogs.id, callLog.id));

        // Deduct cost if answered
        if (status === 'answered') {
            await this.deductCallCost(callLog.orgId, callLog.id);
        }

        // Retry if not answered and retryCount < 1
        if (status === 'not_answered' && (callLog.retryCount || 0) < 1) {
            logger.info(`Retrying call to ${callLog.phone} (attempt ${(callLog.retryCount || 0) + 1})`);
            await db.update(callLogs).set({
                retryCount: (callLog.retryCount || 0) + 1,
                status: 'pending',
                updatedAt: new Date(),
            }).where(eq(callLogs.id, callLog.id));

            // Re-place the call
            const message = await db.select().from(messages).where(eq(messages.id, callLog.messageId));
            if (message[0]) {
                const audioUrls = message[0].audioUrls as Record<string, string>;
                const audioUrl = audioUrls[callLog.languageUsed] || Object.values(audioUrls)[0];

                if (this.voice) {
                    try {
                        await this.voice.call({
                            callFrom: config.atVoicePhone,
                            callTo: [callLog.phone],
                            clientRequestId: callLog.id,
                        });
                    } catch (err) {
                        logger.error(`Retry call failed for ${callLog.phone}:`, err);
                        await db.update(callLogs).set({
                            status: 'failed',
                            updatedAt: new Date(),
                        }).where(eq(callLogs.id, callLog.id));
                    }
                }
            }
        }

        // Check if all calls for this message are completed
        await this.checkMessageCompletion(callLog.messageId);
    }

    private async deductCallCost(orgId: string, callLogId: string) {
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        if (!wallet) return;

        const cost = config.pricePerCall;
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
            description: `Voice call charge`,
            reference: callLogId,
        });
    }

    private async checkMessageCompletion(messageId: string) {
        const pending = await db.select().from(callLogs)
            .where(and(
                eq(callLogs.messageId, messageId),
                sql`${callLogs.status} IN ('pending', 'queued')`
            ));

        if (pending.length === 0) {
            await db.update(messages).set({
                status: 'completed',
                updatedAt: new Date(),
            }).where(eq(messages.id, messageId));
            logger.info(`Message ${messageId} completed`);
        }
    }

    async getCallLogs(orgId: string, messageId?: string) {
        if (messageId) {
            return db.select().from(callLogs)
                .where(and(eq(callLogs.orgId, orgId), eq(callLogs.messageId, messageId)));
        }
        return db.select().from(callLogs).where(eq(callLogs.orgId, orgId));
    }

    async getEstimatedCost(orgId: string, recipientCount: number) {
        const costPerCall = config.pricePerCall;
        const total = recipientCount * costPerCall;
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));

        return {
            costPerCall,
            recipientCount,
            totalEstimated: total,
            currentBalance: parseFloat(wallet?.balance || '0'),
            sufficient: parseFloat(wallet?.balance || '0') >= total,
        };
    }
}

export const voiceService = new VoiceService();
