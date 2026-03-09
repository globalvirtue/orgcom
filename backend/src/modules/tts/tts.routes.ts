import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { ttsService } from '../../services/tts.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * POST /api/tts/generate
 * Generate audio from text using Spitch TTS
 * Body: { text: string, language: string }
 * Returns: audio/mpeg blob
 */
router.post('/generate', authenticate, async (req, res, next) => {
    try {
        const { text, language } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const lang = language || 'en';
        logger.info(`TTS generate request: lang=${lang}, text=${text.substring(0, 50)}...`);

        const audioBuffer = await ttsService.generateAudioBuffer(text.trim(), lang);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length.toString(),
            'Content-Disposition': `attachment; filename="tts_${lang}_${Date.now()}.mp3"`,
        });

        res.send(audioBuffer);
    } catch (err) {
        logger.error('TTS generate endpoint error:', err);
        next(err);
    }
});

export default router;
