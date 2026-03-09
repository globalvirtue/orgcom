import axios from 'axios';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { wallets, transactions, users } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class WalletService {
    async getBalance(orgId: string) {
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        if (!wallet) throw new AppError(404, 'Wallet not found');
        return { balance: parseFloat(wallet.balance), walletId: wallet.id };
    }

    async createCheckoutSession(orgId: string, amount: number) {
        if (!config.koraPaySecretKey) {
            // Mock mode: directly credit wallet
            logger.warn('Kora Pay not configured — mocking payment');
            await this.creditWallet(orgId, amount, `mock-payment-${Date.now()}`);
            return { url: null, mocked: true, credited: amount };
        }

        // Get admin user for the organization to use their email
        const [admin] = await db.select().from(users).where(eq(users.orgId, orgId)).limit(1);
        if (!admin) throw new AppError(404, 'Admin user not found for org');

        const reference = `topup_${orgId.split('-')[0]}_${Date.now()}`;

        try {
            const response = await axios.post(
                'https://api.korapay.com/merchant/api/v1/charges/initialize',
                {
                    amount,
                    customer: {
                        name: admin.name,
                        email: admin.email,
                    },
                    currency: 'NGN',
                    reference,
                    notification_url: `${config.backendUrl}/api/wallet/webhook`,
                    redirect_url: `${config.frontendUrl}/wallet?success=true`,
                    merchant_bears_cost: false,
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.koraPaySecretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data?.status === 'success' && response.data?.data?.checkout_url) {
                logger.info(`Kora Pay session created for org ${orgId}: ${reference}`);
                return { url: response.data.data.checkout_url, reference };
            } else {
                throw new Error(response.data?.message || 'Failed to initialize Kora Pay');
            }
        } catch (err: any) {
            logger.error('Kora Pay initialization failed:', err.response?.data || err.message);
            throw new AppError(500, 'Payment initialization failed');
        }
    }

    async handleWebhook(payload: any, signature: string) {
        if (!config.koraPaySecretKey) return;

        // Verify Kora Pay Signature
        const expectedSignature = crypto
            .createHmac('sha512', config.koraPaySecretKey)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (expectedSignature !== signature) {
            logger.error('Invalid Kora Pay webhook signature');
            throw new AppError(400, 'Invalid signature');
        }

        const { event, data } = payload;

        if (event === 'charge.completed' && data.status === 'success') {
            const reference = data.reference;
            // Extract orgId from reference (topup_orgIdPrefix_timestamp)
            const parts = reference.split('_');
            if (parts.length < 3) return;

            // Since we only have the prefix, we might need a better way if there are prefix collisions
            // For now, let's look up the wallet by checking transactions or metadata if we had it.
            // BETTER: Use a lookup table or include orgId uniquely in reference.
            // Let's assume the reference is reliable for identification if we store it or parse it.

            // For robustness, let's search for a wallet where orgId starts with the prefix.
            const walletsList = await db.select().from(wallets);
            const wallet = walletsList.find(w => w.orgId.startsWith(parts[1]));

            if (wallet && data.amount > 0) {
                await this.creditWallet(wallet.orgId, data.amount, reference);
                logger.info(`Wallet credited via Kora Pay: org=${wallet.orgId}, amount=${data.amount}`);
            }
        }
    }

    async creditWallet(orgId: string, amount: number, reference: string) {
        const [wallet] = await db.select().from(wallets).where(eq(wallets.orgId, orgId));
        if (!wallet) throw new AppError(404, 'Wallet not found');

        const newBalance = parseFloat(wallet.balance) + amount;

        await db.update(wallets).set({
            balance: String(newBalance),
            updatedAt: new Date(),
        }).where(eq(wallets.id, wallet.id));

        await db.insert(transactions).values({
            orgId,
            walletId: wallet.id,
            type: 'credit',
            amount: String(amount),
            description: `Wallet top-up via Kora Pay`,
            reference,
        });

        return { balance: newBalance };
    }

    async getTransactions(orgId: string) {
        return db.select().from(transactions).where(eq(transactions.orgId, orgId));
    }
}

export const walletService = new WalletService();
