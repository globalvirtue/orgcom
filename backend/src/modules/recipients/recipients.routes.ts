import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import fs from 'fs';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { recipientsService } from './recipients.service.js';
import { createRecipientSchema, createGroupSchema, addGroupMembersSchema, listRecipientsQuerySchema, bulkActionSchema } from './recipients.schemas.js';

const router = Router();
const upload = multer({ dest: '/tmp/uploads/' });

// ─── Recipients ───

router.get('/', authenticate, async (req, res, next) => {
    try {
        const query = listRecipientsQuerySchema.parse(req.query);
        const result = await recipientsService.list(req.user!.orgId, query);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/bulk-delete', authenticate, validate(bulkActionSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.bulkDelete(req.user!.orgId, req.body.recipientIds);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/bulk-assign-group', authenticate, validate(bulkActionSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.bulkAssignToGroup(req.user!.orgId, req.body.groupId, req.body.recipientIds);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/bulk-remove-group', authenticate, validate(bulkActionSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.bulkRemoveFromGroup(req.user!.orgId, req.body.groupId, req.body.recipientIds);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/', authenticate, validate(createRecipientSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.create(req.user!.orgId, req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

import * as XLSX from 'xlsx';

router.post('/bulk', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'File is required' });
            return;
        }

        let rows: any[] = [];
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
            const workbook = XLSX.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(sheet);
        } else {
            const csvContent = fs.readFileSync(req.file.path, 'utf-8');
            const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
            rows = data as any[];
        }

        const normalizedRows = rows.map((row) => ({
            phone: String(row.phone || row.Phone || row.phone_number || '').trim(),
            name: row.name || row.Name || row.full_name || undefined,
            languagePreference: row.language || row.Language || row.language_preference || undefined,
        })).filter((r) => r.phone);

        const { groupId } = req.body;
        const result = await recipientsService.bulkCreate(req.user!.orgId, normalizedRows, groupId);
        fs.unlinkSync(req.file.path);
        res.status(201).json({ created: result.length, recipients: result });
    } catch (err) { next(err); }
});

router.post('/bulk-json', authenticate, async (req, res, next) => {
    try {
        const { recipients: rows, groupId } = req.body;
        if (!Array.isArray(rows)) {
            res.status(400).json({ error: 'Recipients must be an array' });
            return;
        }
        const result = await recipientsService.bulkCreate(req.user!.orgId, rows, groupId);
        res.status(201).json({ created: result.length, recipients: result });
    } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await recipientsService.getById(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await recipientsService.update(req.user!.orgId, req.params.id, req.body);
        res.json(result);
    } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await recipientsService.delete(req.user!.orgId, req.params.id);
        res.status(204).send();
    } catch (err) { next(err); }
});

// ─── Groups ───

router.get('/groups/list', authenticate, async (req, res, next) => {
    try {
        const result = await recipientsService.listGroups(req.user!.orgId);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/groups', authenticate, validate(createGroupSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.createGroup(req.user!.orgId, req.body);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

router.get('/groups/:id', authenticate, async (req, res, next) => {
    try {
        const result = await recipientsService.getGroup(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

router.delete('/groups/:id', authenticate, async (req, res, next) => {
    try {
        await recipientsService.deleteGroup(req.user!.orgId, req.params.id);
        res.status(204).send();
    } catch (err) { next(err); }
});

router.get('/groups/:id/members', authenticate, async (req, res, next) => {
    try {
        const result = await recipientsService.getGroupMembers(req.user!.orgId, req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/groups/:id/members', authenticate, validate(addGroupMembersSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.addMembers(req.user!.orgId, req.params.id, req.body.recipientIds);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

router.delete('/groups/:id/members', authenticate, validate(addGroupMembersSchema), async (req, res, next) => {
    try {
        const result = await recipientsService.removeMembers(req.user!.orgId, req.params.id, req.body.recipientIds);
        res.json(result);
    } catch (err) { next(err); }
});

export default router;
