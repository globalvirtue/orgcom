import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { campaignsService } from './campaigns.service.js';
import { createCampaignSchema, updateCampaignSchema } from './campaigns.schemas.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await campaignsService.list(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/', authenticate, validate(createCampaignSchema), async (req, res, next) => {
    try {
        const result = await campaignsService.create(req.user!.orgId, req.user!.userId, req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await campaignsService.getById(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

router.put('/:id', authenticate, validate(updateCampaignSchema), async (req, res, next) => {
    try {
        const result = await campaignsService.update(req.user!.orgId, req.params.id, req.body);
        res.json(result);
    } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await campaignsService.delete(req.user!.orgId, req.params.id);
        res.status(204).send();
    } catch (err) { next(err); }
});

export default router;
