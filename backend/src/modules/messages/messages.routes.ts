import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { messagesService } from './messages.service.js';
import { createMessageSchema, updateMessageSchema } from './messages.schemas.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await messagesService.list(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/', authenticate, validate(createMessageSchema), async (req, res, next) => {
    try {
        const result = await messagesService.create(req.user!.orgId, req.user!.userId, req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await messagesService.getById(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

router.put('/:id', authenticate, validate(updateMessageSchema), async (req, res, next) => {
    try {
        const result = await messagesService.update(req.user!.orgId, req.params.id, req.body);
        res.json(result);
    } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await messagesService.delete(req.user!.orgId, req.params.id);
        res.status(204).send();
    } catch (err) { next(err); }
});

// POST /api/messages/:id/translate
router.post('/:id/translate', authenticate, async (req, res, next) => {
    try {
        const result = await messagesService.translate(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/messages/:id/generate-audio
router.post('/:id/generate-audio', authenticate, async (req, res, next) => {
    try {
        const result = await messagesService.generateAudio(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/messages/:id/recipients
router.get('/:id/recipients', authenticate, async (req, res, next) => {
    try {
        const result = await messagesService.getRecipients(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

export default router;
