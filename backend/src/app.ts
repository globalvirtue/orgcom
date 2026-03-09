import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { schedulerService } from './services/scheduler.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import recipientRoutes from './modules/recipients/recipients.routes.js';
import campaignRoutes from './modules/campaigns/campaigns.routes.js';
import messageRoutes from './modules/messages/messages.routes.js';
import voiceRoutes from './modules/voice/voice.routes.js';
import walletRoutes from './modules/wallet/wallet.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import ttsRoutes from './modules/tts/tts.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Webhook Debug Interceptor ───
app.all('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        logger.info(`🚨 [ANY REQUEST] ${req.method} ${req.originalUrl}`);
    }
    logger.info(`🚨 [HEADERS] ${JSON.stringify(req.headers)}`);
    logger.info(`🚨 [BODY] ${JSON.stringify(req.body)}`);

    const oldSend = res.send;
    res.send = function (data) {
        logger.info(`🚨 [RESPONSE LOG] ${req.originalUrl} => Status: ${res.statusCode}, Type: ${res.get('Content-Type')}`);
        logger.info(`🚨 [RESPONSE BODY] ${data}`);
        return oldSend.apply(res, arguments as any);
    };
    next();
});

// ─── Global Middleware ───
app.use(helmet());
app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
}));
app.use(apiLimiter);

// ─── Static Audio Files ───
app.use('/api/audio', express.static(path.resolve(config.audioStoragePath)));



// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tts', ttsRoutes);

// ─── Chat/Webhook Compat Routes ───
// These are for Africa's Talking webhooks configured with /api/chat prefix
app.use('/api/chat/voice', voiceRoutes);
app.use('/api/chat/tts', ttsRoutes);

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handling ───
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───
const server = app.listen(config.port, () => {
    logger.info(`🚀 RemindMe API running on port ${config.port}`);
    logger.info(`   Environment: ${config.nodeEnv}`);

    // Start scheduler
    schedulerService.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    schedulerService.stop();
    server.close(() => process.exit(0));
});

export default app;
