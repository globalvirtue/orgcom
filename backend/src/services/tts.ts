import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Spitch voice mapping per language
const VOICE_MAP: Record<string, string> = {
    en: 'john',
    yo: 'funmi',
    ha: 'zainab',
    ig: 'ebuka',
};

export class TtsService {
    private baseUrl = 'https://api.spi-tch.com/v1';

    constructor() {
        // Ensure audio storage directory exists
        const storagePath = config.audioStoragePath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
    }

    /**
     * Generate audio from text using Spitch TTS REST API directly via fetch
     */
    async generateAudioBuffer(text: string, language: string): Promise<Buffer> {
        if (!config.spitchApiKey) {
            logger.warn('SPITCH_API_KEY not set — returning silence placeholder');
            return Buffer.alloc(128);
        }

        const voice = VOICE_MAP[language] || VOICE_MAP['en'];
        const lang = (['en', 'yo', 'ha', 'ig'].includes(language)) ? language : 'en';

        try {
            logger.info(`Generating TTS via Spitch REST API: lang=${lang}, voice=${voice}, text="${text.substring(0, 60)}..."`);

            const response = await fetch(`${this.baseUrl}/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.spitchApiKey}`,
                    'Accept': 'audio/mpeg, audio/wav, */*',
                    'User-Agent': 'RemindMe-Backend/1.0 (Node/Fetch)'
                },
                body: JSON.stringify({
                    text,
                    language: lang,
                    voice,
                    format: 'mp3'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Spitch API HTTP error ${response.status}: ${errorText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            logger.info(`TTS response received successfully (${arrayBuffer.byteLength} bytes)`);
            return Buffer.from(new Uint8Array(arrayBuffer));

        } catch (err) {
            logger.error(`Spitch TTS fetch failed for lang=${lang}:`, err);
            throw err;
        }
    }

    /**
     * Generate audio and save to file, return URL path
     */
    async generateAudio(text: string, language: string, messageId: string): Promise<string> {
        const filename = `${messageId}_${language}.mp3`;
        const filePath = path.join(config.audioStoragePath, filename);

        // Return existing file if already generated and not a placeholder
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 200) {
            logger.info(`Audio already exists: ${filename}`);
            return `/api/audio/${filename}`;
        }

        const buffer = await this.generateAudioBuffer(text, language);
        fs.writeFileSync(filePath, buffer);
        logger.info(`Generated and saved audio: ${filename} (${buffer.length} bytes)`);

        return `/api/audio/${filename}`;
    }

    /**
     * Generate audio for all translations of a message
     */
    async generateBatchAudio(
        translations: Record<string, string>,
        messageId: string
    ): Promise<Record<string, string>> {
        const audioUrls: Record<string, string> = {};

        for (const [lang, text] of Object.entries(translations)) {
            const url = await this.generateAudio(text, lang, messageId);
            audioUrls[lang] = url;
        }

        return audioUrls;
    }
}

export const ttsService = new TtsService();
