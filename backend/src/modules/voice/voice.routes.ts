import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { voiceService } from './voice.service.js';

const router = Router();

// POST /api/voice/send/:messageId — trigger voice delivery
router.post('/send/:messageId', authenticate, async (req, res, next) => {
    try {
        const result = await voiceService.sendMessage(req.user!.orgId, req.params.messageId);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/voice/callback — Africa's Talking webhook
router.post('/callback', async (req, res, next) => {
    try {
        const responseXml = await voiceService.handleCallback(req.body);
        res.header('Content-Type', 'application/xml');
        res.send(responseXml || '<Response/>');
    } catch (err) { next(err); }
});

// GET /api/voice/logs — get call logs
router.get('/logs', authenticate, async (req, res, next) => {
    try {
        const messageId = req.query.messageId as string | undefined;
        const result = await voiceService.getCallLogs(req.user!.orgId, messageId);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/voice/estimate — get cost estimate
router.get('/estimate', authenticate, async (req, res, next) => {
    try {
        const count = parseInt(req.query.recipientCount as string, 10) || 0;
        const result = await voiceService.getEstimatedCost(req.user!.orgId, count);
        res.json(result);
    } catch (err) { next(err); }
});

export default router;
