import { z } from 'zod';

export const createCampaignSchema = z.object({
    name: z.string().min(1, 'Campaign name is required'),
    description: z.string().optional(),
    type: z.enum(['sms', 'voice']),
    mode: z.enum(['one_time', 'scheduled', 'recurring']),

    // Audience
    audience: z.object({
        groupIds: z.array(z.string().uuid()).optional(),
        recipientIds: z.array(z.string().uuid()).optional(),
        pastedPhones: z.array(z.string()).optional(),
        all: z.boolean().optional(),
    }),

    // Message Content
    messageContent: z.object({
        sourceText: z.string().min(1, 'Message text is required'),
        sourceLanguage: z.string().optional(),
        targetLanguages: z.array(z.string()).optional(),
        audioSource: z.enum(['upload', 'record', 'tts']).optional(),
        audioUrl: z.string().optional(),
        smsBody: z.string().optional(),
    }),

    // Scheduling
    scheduledAt: z.string().datetime().optional().nullable(),
    recurringInterval: z.enum(['daily', 'weekly', 'monthly']).optional().nullable(),
    recurringEndDate: z.string().datetime().optional().nullable(),
});

export const updateCampaignSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['draft', 'scheduled', 'sending', 'completed', 'cancelled']).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
