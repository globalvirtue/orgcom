import { z } from 'zod';

export const signupSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required'),
    organizationName: z.string().min(1, 'Organization name is required'),
    defaultLanguage: z.string().default('en'),
    timezone: z.string().default('Africa/Lagos'),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
});

export const inviteSchema = z.object({
    email: z.string().email('Invalid email'),
    role: z.enum(['admin', 'campaign_manager', 'viewer']).default('campaign_manager'),
});

export const acceptInviteSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    name: z.string().min(1, 'Name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
