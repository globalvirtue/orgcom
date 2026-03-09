import cron from 'node-cron';
import { db } from '../db/index.js';
import { campaigns, messages } from '../db/schema/index.js';
import { eq, and, lte, isNull, or, sql } from 'drizzle-orm';
import { voiceService } from '../modules/voice/voice.service.js';
import { smsService } from '../modules/sms/sms.service.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
    private job: cron.ScheduledTask | null = null;

    start() {
        // Run every minute to check for pending broadcasts
        this.job = cron.schedule('* * * * *', async () => {
            try {
                await this.processScheduledCampaigns();
                await this.processLegacyMessages();
            } catch (err) {
                logger.error('Scheduler error:', err);
            }
        });
        logger.info('Broadcast scheduler started');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            logger.info('Broadcast scheduler stopped');
        }
    }

    private async processScheduledCampaigns() {
        const now = new Date();

        // 1. Find scheduled or recurring campaigns that are due
        const dueCampaigns = await db.select().from(campaigns).where(
            and(
                or(eq(campaigns.status, 'scheduled'), eq(campaigns.status, 'active')),
                or(
                    and(eq(campaigns.mode, 'one_time'), lte(campaigns.scheduledAt, now)),
                    and(eq(campaigns.mode, 'scheduled'), lte(campaigns.scheduledAt, now)),
                    and(eq(campaigns.mode, 'recurring'), lte(campaigns.nextRunDate, now))
                )
            )
        );

        for (const campaign of dueCampaigns) {
            logger.info(`Processing campaign: ${campaign.name} (${campaign.id})`);

            try {
                // Fetch the primary message for this campaign run
                const [message] = await db.select().from(messages)
                    .where(eq(messages.campaignId, campaign.id))
                    .limit(1);

                if (!message) {
                    logger.warn(`No message found for campaign ${campaign.id}`);
                    continue;
                }

                // Execute Send
                if (campaign.type === 'voice') {
                    await voiceService.sendMessage(campaign.orgId, message.id);
                } else if (campaign.type === 'sms') {
                    await smsService.sendMessage(campaign.orgId, message.id);
                } else {
                    // TODO: Implement other message types
                    logger.info(`Unsupported campaign type for campaign ${campaign.id}: ${campaign.type}`);
                }

                // Update Campaign State
                if (campaign.mode === 'recurring') {
                    const nextRun = this.calculateNextRun(campaign.nextRunDate || now, campaign.recurringInterval || 'daily');
                    await db.update(campaigns)
                        .set({
                            nextRunDate: nextRun,
                            status: 'active',
                            updatedAt: new Date()
                        })
                        .where(eq(campaigns.id, campaign.id));
                } else {
                    await db.update(campaigns)
                        .set({ status: 'completed', updatedAt: new Date() })
                        .where(eq(campaigns.id, campaign.id));
                }

            } catch (err) {
                logger.error(`Failed to execute campaign ${campaign.id}:`, err);
            }
        }
    }

    private calculateNextRun(current: Date, interval: string): Date {
        const next = new Date(current);
        if (interval === 'daily') next.setDate(next.getDate() + 1);
        else if (interval === 'weekly') next.setDate(next.getDate() + 7);
        else if (interval === 'monthly') next.setMonth(next.getMonth() + 1);
        return next;
    }

    private async processLegacyMessages() {
        const now = new Date();
        const scheduledMsgs = await db.select().from(messages).where(
            and(
                eq(messages.status, 'scheduled'),
                lte(messages.scheduledAt, now),
                isNull(messages.campaignId) // Only legacy messages without campaigns
            )
        );

        for (const msg of scheduledMsgs) {
            try {
                await voiceService.sendMessage(msg.orgId, msg.id);
            } catch (err) {
                logger.error(`Failed to send legacy message ${msg.id}:`, err);
            }
        }
    }
}

export const schedulerService = new SchedulerService();
