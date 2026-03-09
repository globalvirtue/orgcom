import { z } from 'zod';

export const fundWalletSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;
