import { Router, raw } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { walletService } from './wallet.service.js';
import { fundWalletSchema } from './wallet.schemas.js';

const router = Router();

// GET /api/wallet/balance
router.get('/balance', authenticate, async (req, res, next) => {
    try {
        const result = await walletService.getBalance(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/wallet/fund — create Stripe checkout session
router.post('/fund', authenticate, authorize('admin'), validate(fundWalletSchema), async (req, res, next) => {
    try {
        const result = await walletService.createCheckoutSession(req.user!.orgId, req.body.amount);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/wallet/transactions
router.get('/transactions', authenticate, async (req, res, next) => {
    try {
        const result = await walletService.getTransactions(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/wallet/webhook — Kora Pay webhook
router.post('/webhook', async (req, res, next) => {
    try {
        const sig = req.headers['kora-signature'] as string;
        await walletService.handleWebhook(req.body, sig);
        res.json({ received: true });
    } catch (err) { next(err); }
});

export default router;
