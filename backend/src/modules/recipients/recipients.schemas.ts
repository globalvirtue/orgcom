import { z } from 'zod';

export const createRecipientSchema = z.object({
    phone: z.string().min(1, 'Phone is required'),
    name: z.string().optional(),
    languagePreference: z.string().optional(),
    groupIds: z.array(z.string().uuid()).optional(),
});

export const createGroupSchema = z.object({
    name: z.string().min(1, 'Group name is required'),
});

export const addGroupMembersSchema = z.object({
    recipientIds: z.array(z.string().uuid()).min(1, 'At least one recipient is required'),
});

export const listRecipientsQuerySchema = z.object({
    page: z.string().optional().transform(v => parseInt(v || '1')),
    limit: z.string().optional().transform(v => parseInt(v || '50')),
    search: z.string().optional(),
    language: z.string().optional(),
    groupId: z.string().uuid().optional(),
});

export const bulkActionSchema = z.object({
    recipientIds: z.array(z.string().uuid()).min(1),
    groupId: z.string().uuid().optional(),
});

export type CreateRecipientInput = z.infer<typeof createRecipientSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type AddGroupMembersInput = z.infer<typeof addGroupMembersSchema>;
export type ListRecipientsQuery = z.infer<typeof listRecipientsQuerySchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
