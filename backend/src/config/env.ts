import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');
console.log('[ENV DEBUG] Loading .env from:', envPath);
dotenv.config({ path: envPath });
console.log('[ENV DEBUG] SPITCH_API_KEY from process.env:', process.env.SPITCH_API_KEY ? `Set (${process.env.SPITCH_API_KEY.substring(0, 5)}...)` : 'Not set');

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',

    // Database
    databaseUrl: process.env.DATABASE_URL || '',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    // Africa's Talking
    atApiKey: process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY || '',
    atUsername: process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME || '',
    atVoicePhone: process.env.AFRICASTALKING_FROM_NUMBER || process.env.AT_VOICE_PHONE || '',

    // Spitch (TTS + Translation)
    spitchApiKey: process.env.SPITCH_API_KEY || '',

    // Kora Pay
    koraPaySecretKey: process.env.KORAPAY_SECRET_KEY || '',
    koraPayPublicKey: process.env.KORAPAY_PUBLIC_KEY || '',
    koraPayWebhookSecret: process.env.KORAPAY_WEBHOOK_SECRET || '',
    pricePerCall: parseFloat(process.env.PRICE_PER_CALL || '25'), // In NGN
    pricePerSms: parseFloat(process.env.PRICE_PER_SMS || '5'), // In NGN

    // Audio Storage
    audioStoragePath: process.env.AUDIO_STORAGE_PATH || './uploads/audio',
} as const;
