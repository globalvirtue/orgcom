import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { dashboardService } from './dashboard.service.js';
import { SUPPORTED_LANGUAGES } from '../../config/languages.js';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', authenticate, async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const result = await dashboardService.getOverview(
            req.user!.orgId,
            startDate as string,
            endDate as string
        );
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/dashboard/messages
router.get('/messages', authenticate, async (req, res, next) => {
    try {
        const result = await dashboardService.getMessageSummaries(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/dashboard/campaigns
router.get('/campaigns', authenticate, async (req, res, next) => {
    try {
        const result = await dashboardService.getCampaignSummaries(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/languages — available languages
router.get('/languages', (_req, res) => {
    res.json(SUPPORTED_LANGUAGES);
});

export default router;
