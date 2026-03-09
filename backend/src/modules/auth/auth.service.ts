import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { organizations, users, wallets, invitations } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import type { SignupInput, LoginInput, InviteInput, AcceptInviteInput } from './auth.schemas.js';
import type { JwtPayload } from '../../middleware/auth.js';

export class AuthService {
    async signup(input: SignupInput) {
        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, input.email));
        if (existing.length > 0) {
            throw new AppError(409, 'Email already registered');
        }

        const passwordHash = await bcrypt.hash(input.password, 12);

        // Create organization
        const [org] = await db.insert(organizations).values({
            name: input.organizationName,
            defaultLanguage: input.defaultLanguage,
            timezone: input.timezone,
        }).returning();

        // Create admin user
        const [user] = await db.insert(users).values({
            orgId: org.id,
            email: input.email,
            passwordHash,
            name: input.name,
            role: 'admin',
        }).returning();

        // Create wallet for org
        await db.insert(wallets).values({
            orgId: org.id,
            balance: '0',
        });

        const token = this.generateToken(user);
        logger.info(`New organization registered: ${org.name} (${org.id})`);

        return {
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            organization: { id: org.id, name: org.name },
        };
    }

    async login(input: LoginInput) {
        const [user] = await db.select().from(users).where(eq(users.email, input.email));
        if (!user) {
            throw new AppError(401, 'Invalid email or password');
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
            throw new AppError(401, 'Invalid email or password');
        }

        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId));

        const token = this.generateToken(user);
        logger.info(`User logged in: ${user.email}`);

        return {
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            organization: { id: org.id, name: org.name },
        };
    }

    async invite(orgId: string, input: InviteInput) {
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(invitations).values({
            orgId,
            email: input.email,
            role: input.role,
            token,
            expiresAt,
        });

        logger.info(`Invitation sent to ${input.email} for org ${orgId}`);

        return { token, email: input.email, expiresAt };
    }

    async acceptInvite(input: AcceptInviteInput) {
        const [invitation] = await db.select().from(invitations)
            .where(and(eq(invitations.token, input.token), eq(invitations.used, false)));

        if (!invitation) {
            throw new AppError(400, 'Invalid or expired invitation');
        }

        if (new Date() > invitation.expiresAt) {
            throw new AppError(400, 'Invitation has expired');
        }

        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, invitation.email));
        if (existing.length > 0) {
            throw new AppError(409, 'Email already registered');
        }

        const passwordHash = await bcrypt.hash(input.password, 12);

        const [user] = await db.insert(users).values({
            orgId: invitation.orgId,
            email: invitation.email,
            passwordHash,
            name: input.name,
            role: invitation.role,
        }).returning();

        // Mark invitation as used
        await db.update(invitations).set({ used: true }).where(eq(invitations.id, invitation.id));

        const [org] = await db.select().from(organizations).where(eq(organizations.id, invitation.orgId));
        const token = this.generateToken(user);

        logger.info(`Invitation accepted by ${invitation.email}`);

        return {
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            organization: { id: org.id, name: org.name },
        };
    }

    async getMe(userId: string) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user) throw new AppError(404, 'User not found');

        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId));

        return {
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            organization: { id: org.id, name: org.name, defaultLanguage: org.defaultLanguage, timezone: org.timezone },
        };
    }

    async getOrgUsers(orgId: string) {
        const orgUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.orgId, orgId));

        return orgUsers;
    }

    private generateToken(user: { id: string; orgId: string; role: string; email: string }) {
        const payload: JwtPayload = {
            userId: user.id,
            orgId: user.orgId,
            role: user.role as JwtPayload['role'],
            email: user.email,
        };
        return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    }
}

export const authService = new AuthService();
