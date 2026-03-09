import winston from 'winston';
import { config } from '../config/env.js';

export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        config.nodeEnv === 'production'
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}]: ${message}${metaStr}`;
                })
            )
    ),
    transports: [
        new winston.transports.Console(),
        // Debug log for agentic debugging
        new winston.transports.File({
            filename: '/Users/globalvirtue/.gemini/antigravity/brain/ffff8c40-bcbe-496b-b55c-85e70e8aa676/debug_voice.log',
            level: 'debug'
        }),
        ...(config.nodeEnv === 'production'
            ? [new winston.transports.File({ filename: 'error.log', level: 'error' })]
            : []),
    ],
});
