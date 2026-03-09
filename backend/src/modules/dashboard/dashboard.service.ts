import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { callLogs, messages, campaigns } from '../../db/schema/index.js';
import { logger } from '../../utils/logger.js';

export class DashboardService {
    async getOverview(orgId: string, startDate?: string, endDate?: string) {
        let conditions: any[] = [eq(callLogs.orgId, orgId)];
        if (startDate) conditions.push(gte(callLogs.createdAt, new Date(startDate)));
        if (endDate) conditions.push(lte(callLogs.createdAt, new Date(endDate)));

        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

        // Total calls
        const allCalls = await db.select().from(callLogs).where(whereClause);

        const totalCalls = allCalls.length;
        const answered = allCalls.filter((c) => c.status === 'answered').length;
        const failed = allCalls.filter((c) => c.status === 'failed' || c.status === 'not_answered').length;
        const answerRate = totalCalls > 0 ? (answered / totalCalls) * 100 : 0;

        const totalDuration = allCalls
            .filter((c) => c.status === 'answered')
            .reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
        const avgDuration = answered > 0 ? totalDuration / answered : 0;

        const totalCost = allCalls.reduce((sum, c) => sum + parseFloat(c.cost || '0'), 0);

        return {
            totalCalls,
            answeredCalls: answered,
            failedCalls: failed,
            answerRate: Math.round(answerRate * 100) / 100,
            avgDuration: Math.round(avgDuration * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
        };
    }

    async getMessageSummaries(orgId: string) {
        const msgs = await db.select().from(messages).where(eq(messages.orgId, orgId));

        const summaries = [];
        for (const msg of msgs) {
            const calls = await db.select().from(callLogs).where(eq(callLogs.messageId, msg.id));
            const totalCalls = calls.length;
            const answered = calls.filter((c) => c.status === 'answered').length;
            const totalCost = calls.reduce((sum, c) => sum + parseFloat(c.cost || '0'), 0);

            summaries.push({
                id: msg.id,
                sourceText: msg.sourceText.substring(0, 100),
                status: msg.status,
                totalCalls,
                answeredCalls: answered,
                answerRate: totalCalls > 0 ? Math.round((answered / totalCalls) * 10000) / 100 : 0,
                totalCost: Math.round(totalCost * 100) / 100,
                createdAt: msg.createdAt,
            });
        }

        return summaries;
    }

    async getCampaignSummaries(orgId: string) {
        const camps = await db.select().from(campaigns).where(eq(campaigns.orgId, orgId));

        const summaries = [];
        for (const camp of camps) {
            const calls = await db.select().from(callLogs).where(
                and(eq(callLogs.orgId, orgId), eq(callLogs.campaignId, camp.id))
            );
            const totalCalls = calls.length;
            const answered = calls.filter((c) => c.status === 'answered').length;
            const totalCost = calls.reduce((sum, c) => sum + parseFloat(c.cost || '0'), 0);

            // Language breakdown
            const languageBreakdown: Record<string, { total: number; answered: number }> = {};
            for (const call of calls) {
                if (!languageBreakdown[call.languageUsed]) {
                    languageBreakdown[call.languageUsed] = { total: 0, answered: 0 };
                }
                languageBreakdown[call.languageUsed].total++;
                if (call.status === 'answered') {
                    languageBreakdown[call.languageUsed].answered++;
                }
            }

            summaries.push({
                id: camp.id,
                name: camp.name,
                status: camp.status,
                totalCalls,
                answeredCalls: answered,
                answerRate: totalCalls > 0 ? Math.round((answered / totalCalls) * 10000) / 100 : 0,
                totalCost: Math.round(totalCost * 100) / 100,
                languageBreakdown,
                createdAt: camp.createdAt,
            });
        }

        return summaries;
    }
}

export const dashboardService = new DashboardService();
