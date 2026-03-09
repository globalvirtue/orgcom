import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { authService } from './auth.service.js';
import { signupSchema, loginSchema, inviteSchema, acceptInviteSchema } from './auth.schemas.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', authLimiter, validate(signupSchema), async (req, res, next) => {
    try {
        const result = await authService.signup(req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/auth/invite — Admin only
router.post('/invite', authenticate, authorize('admin'), validate(inviteSchema), async (req, res, next) => {
    try {
        const result = await authService.invite(req.user!.orgId, req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

// POST /api/auth/accept-invite
router.post('/accept-invite', validate(acceptInviteSchema), async (req, res, next) => {
    try {
        const result = await authService.acceptInvite(req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const result = await authService.getMe(req.user!.userId);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/auth/users — list org users
router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const result = await authService.getOrgUsers(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

export default router;
