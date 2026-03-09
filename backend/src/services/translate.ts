import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class TranslateService {
    private baseUrl = 'https://api.spi-tch.com/v1';

    async translate(text: string, targetLang: string, sourceLang?: string): Promise<{ translatedText: string }> {
        if (!config.spitchApiKey) {
            logger.warn('SPITCH_API_KEY not set — returning mock translation');
            return { translatedText: `[${targetLang}] ${text}` };
        }

        // Spitch supports: en, ha, ig, yo
        const supportedLangs = ['en', 'ha', 'ig', 'yo'];
        if (!supportedLangs.includes(targetLang)) {
            logger.warn(`Language ${targetLang} not supported by Spitch — returning original text`);
            return { translatedText: text };
        }

        try {
            logger.info(`Translating via Spitch REST API from ${sourceLang || 'en'} to ${targetLang}`);

            const response = await fetch(`${this.baseUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.spitchApiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'RemindMe-Backend/1.0 (Node/Fetch)'
                },
                body: JSON.stringify({
                    text,
                    source: sourceLang || 'en',
                    target: targetLang
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Spitch API HTTP error ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            logger.info(`Translated text to ${targetLang}: ${(data.text || '').substring(0, 50)}...`);

            return { translatedText: data.text || text };
        } catch (err) {
            logger.error(`Spitch translation fetch failed for ${targetLang}:`, err);
            return { translatedText: `[${targetLang}] ${text}` };
        }
    }

    async translateBatch(text: string, targetLangs: string[], sourceLang: string): Promise<Record<string, string>> {
        const results: Record<string, string> = {};
        results[sourceLang] = text;

        for (const lang of targetLangs) {
            if (lang === sourceLang) continue;
            const { translatedText } = await this.translate(text, lang, sourceLang);
            results[lang] = translatedText;
        }

        return results;
    }
}

export const translateService = new TranslateService();
