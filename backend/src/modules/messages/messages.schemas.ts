import { z } from 'zod';

export const createMessageSchema = z.object({
    sourceText: z.string().min(1, 'Message text is required'),
    sourceLanguage: z.string().optional(),
    targetLanguages: z.array(z.string()).optional(),
    campaignId: z.string().uuid().optional().nullable(),
    recipientIds: z.array(z.string().uuid()).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
});

export const updateMessageSchema = z.object({
    sourceText: z.string().min(1).optional(),
    sourceLanguage: z.string().min(1).optional(),
    targetLanguages: z.array(z.string()).min(1).optional(),
    campaignId: z.string().uuid().optional().nullable(),
});

export const sendMessageSchema = z.object({
    recipientIds: z.array(z.string().uuid()).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
