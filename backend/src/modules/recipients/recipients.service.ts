import { eq, and, inArray, or, ilike, desc, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { recipients, recipientGroups, recipientGroupMembers } from '../../db/schema/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import type { CreateRecipientInput, CreateGroupInput, ListRecipientsQuery } from './recipients.schemas.js';

export class RecipientsService {
    // ─── Recipients ───

    async create(orgId: string, input: CreateRecipientInput) {
        const [recipient] = await db.insert(recipients).values({
            orgId,
            phone: input.phone,
            name: input.name || null,
            languagePreference: input.languagePreference || null,
        }).returning();

        if (input.groupIds && input.groupIds.length > 0) {
            const groupValues = input.groupIds.map(groupId => ({
                recipientId: recipient.id,
                groupId,
            }));
            await db.insert(recipientGroupMembers).values(groupValues).onConflictDoNothing();
        }

        return recipient;
    }

    async bulkCreate(orgId: string, rows: CreateRecipientInput[], groupId?: string) {
        if (rows.length === 0) return [];
        const values = rows.map((r) => ({
            orgId,
            phone: r.phone,
            name: r.name || null,
            languagePreference: r.languagePreference || null,
        }));
        const created = await db.insert(recipients).values(values).returning();

        if (groupId) {
            await this.getGroup(orgId, groupId); // Verify group exists and belongs to org
            const memberValues = created.map(r => ({
                recipientId: r.id,
                groupId,
            }));
            await db.insert(recipientGroupMembers).values(memberValues).onConflictDoNothing();
        }

        logger.info(`Bulk created ${created.length} recipients for org ${orgId} (Group: ${groupId || 'none'})`);
        return created;
    }

    async list(orgId: string, query: ListRecipientsQuery) {
        const { page = 1, limit = 50, search, language, groupId } = query;
        const offset = (page - 1) * limit;

        const whereClauses = [eq(recipients.orgId, orgId)];

        if (search) {
            whereClauses.push(
                or(
                    ilike(recipients.name, `%${search}%`),
                    ilike(recipients.phone, `%${search}%`)
                ) as any
            );
        }

        if (language) {
            whereClauses.push(eq(recipients.languagePreference, language));
        }

        let queryBuilder: any;

        if (groupId) {
            queryBuilder = db.select({
                id: recipients.id,
                orgId: recipients.orgId,
                phone: recipients.phone,
                name: recipients.name,
                languagePreference: recipients.languagePreference,
                createdAt: recipients.createdAt,
                updatedAt: recipients.updatedAt,
            })
                .from(recipients)
                .innerJoin(recipientGroupMembers, eq(recipients.id, recipientGroupMembers.recipientId))
                .where(and(...whereClauses, eq(recipientGroupMembers.groupId, groupId)));
        } else {
            queryBuilder = db.select().from(recipients).where(and(...whereClauses));
        }

        const data = await queryBuilder
            .limit(limit)
            .offset(offset)
            .orderBy(desc(recipients.createdAt));

        const [totalRes] = await db.select({ count: count() }).from(recipients).where(and(...whereClauses));
        const total = Number(totalRes?.count || 0);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    async getById(orgId: string, id: string) {
        const [r] = await db.select().from(recipients)
            .where(and(eq(recipients.id, id), eq(recipients.orgId, orgId)));
        if (!r) throw new AppError(404, 'Recipient not found');

        const groups = await db.select({
            id: recipientGroups.id,
            name: recipientGroups.name,
        })
            .from(recipientGroupMembers)
            .innerJoin(recipientGroups, eq(recipientGroupMembers.groupId, recipientGroups.id))
            .where(eq(recipientGroupMembers.recipientId, id));

        return { ...r, groupIds: groups.map((g: any) => g.id), groups };
    }

    async update(orgId: string, id: string, input: Partial<CreateRecipientInput>) {
        const { groupIds, ...rest } = input;

        const [r] = await db.update(recipients)
            .set({ ...rest, updatedAt: new Date() })
            .where(and(eq(recipients.id, id), eq(recipients.orgId, orgId)))
            .returning();
        if (!r) throw new AppError(404, 'Recipient not found');

        if (groupIds !== undefined) {
            // Simple sync: delete all and re-add
            await db.delete(recipientGroupMembers).where(eq(recipientGroupMembers.recipientId, id));
            if (groupIds.length > 0) {
                const groupValues = groupIds.map(gid => ({
                    recipientId: id,
                    groupId: gid,
                }));
                await db.insert(recipientGroupMembers).values(groupValues).onConflictDoNothing();
            }
        }

        return this.getById(orgId, id);
    }

    async delete(orgId: string, id: string) {
        const [r] = await db.delete(recipients)
            .where(and(eq(recipients.id, id), eq(recipients.orgId, orgId)))
            .returning();
        if (!r) throw new AppError(404, 'Recipient not found');
        return r;
    }

    async bulkDelete(orgId: string, recipientIds: string[]) {
        const result = await db.delete(recipients)
            .where(and(
                eq(recipients.orgId, orgId),
                inArray(recipients.id, recipientIds)
            ))
            .returning();
        return { deleted: result.length };
    }

    // ─── Groups ───

    async createGroup(orgId: string, input: CreateGroupInput) {
        const [group] = await db.insert(recipientGroups).values({
            orgId,
            name: input.name,
        }).returning();
        return group;
    }

    async listGroups(orgId: string) {
        const results = await db.select({
            id: recipientGroups.id,
            name: recipientGroups.name,
            createdAt: recipientGroups.createdAt,
            recipientCount: count(recipientGroupMembers.recipientId),
        })
            .from(recipientGroups)
            .leftJoin(recipientGroupMembers, eq(recipientGroups.id, recipientGroupMembers.groupId))
            .where(eq(recipientGroups.orgId, orgId))
            .groupBy(recipientGroups.id)
            .orderBy(desc(recipientGroups.createdAt));

        return results;
    }

    async getGroup(orgId: string, id: string) {
        const [g] = await db.select().from(recipientGroups)
            .where(and(eq(recipientGroups.id, id), eq(recipientGroups.orgId, orgId)));
        if (!g) throw new AppError(404, 'Group not found');
        return g;
    }

    async deleteGroup(orgId: string, id: string) {
        const [g] = await db.delete(recipientGroups)
            .where(and(eq(recipientGroups.id, id), eq(recipientGroups.orgId, orgId)))
            .returning();
        if (!g) throw new AppError(404, 'Group not found');
        return g;
    }

    async addMembers(orgId: string, groupId: string, recipientIds: string[]) {
        // Verify group belongs to org
        await this.getGroup(orgId, groupId);

        const values = recipientIds.map((rid) => ({
            recipientId: rid,
            groupId,
        }));
        await db.insert(recipientGroupMembers).values(values);
        return { added: recipientIds.length };
    }

    async removeMembers(orgId: string, groupId: string, recipientIds: string[]) {
        await this.getGroup(orgId, groupId);
        await db.delete(recipientGroupMembers)
            .where(and(
                eq(recipientGroupMembers.groupId, groupId),
                inArray(recipientGroupMembers.recipientId, recipientIds)
            ));
        return { removed: recipientIds.length };
    }

    async getGroupMembers(orgId: string, groupId: string) {
        await this.getGroup(orgId, groupId);
        const members = await db.select({
            id: recipients.id,
            phone: recipients.phone,
            name: recipients.name,
            languagePreference: recipients.languagePreference,
        })
            .from(recipientGroupMembers)
            .innerJoin(recipients, eq(recipientGroupMembers.recipientId, recipients.id))
            .where(eq(recipientGroupMembers.groupId, groupId));
        return members;
    }

    async bulkAssignToGroup(orgId: string, groupId: string, recipientIds: string[]) {
        await this.getGroup(orgId, groupId);
        const values = recipientIds.map(rid => ({
            recipientId: rid,
            groupId,
        }));
        await db.insert(recipientGroupMembers).values(values).onConflictDoNothing();
        return { added: recipientIds.length };
    }

    async bulkRemoveFromGroup(orgId: string, groupId: string, recipientIds: string[]) {
        await this.getGroup(orgId, groupId);
        await db.delete(recipientGroupMembers)
            .where(and(
                eq(recipientGroupMembers.groupId, groupId),
                inArray(recipientGroupMembers.recipientId, recipientIds)
            ));
        return { removed: recipientIds.length };
    }
}

export const recipientsService = new RecipientsService();
