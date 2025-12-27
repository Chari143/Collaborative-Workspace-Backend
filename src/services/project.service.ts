import prisma from '../config/prisma';
import redis from '../config/redis';
import { ApiError } from '../middleware/error.middleware';
import { Role } from '@prisma/client';
import { CreateProjectInput, UpdateProjectInput } from '../schemas/validation.schemas';
import { v4 as uuidv4 } from 'uuid';

const CACHE_TTL = 300; // 5 minutes

export class ProjectService {
    async create(userId: string, input: CreateProjectInput) {
        return prisma.project.create({
            data: {
                name: input.name,
                description: input.description,
                ownerId: userId,
                settings: {}
            },
            include: {
                owner: { select: { id: true, email: true, name: true, avatarUrl: true } }
            }
        });
    }

    async getById(projectId: string) {
        const cached = await redis.get(`project:${projectId}`);
        if (cached) {
            return JSON.parse(cached);
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                owner: { select: { id: true, email: true, name: true, avatarUrl: true } },
                workspaces: true,
                collaborators: {
                    include: {
                        user: { select: { id: true, email: true, name: true, avatarUrl: true } }
                    }
                }
            }
        });

        if (!project) {
            throw new ApiError(404, 'Project not found');
        }

        // Cache the result
        await redis.setex(`project:${projectId}`, CACHE_TTL, JSON.stringify(project));
        return project;
    }

    async getAllForUser(userId: string) {
        const [owned, collaborating] = await Promise.all([
            prisma.project.findMany({
                where: { ownerId: userId },
                include: {
                    owner: { select: { id: true, email: true, name: true } },
                    _count: { select: { workspaces: true, collaborators: true } }
                },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.project.findMany({
                where: {
                    collaborators: { some: { userId } }
                },
                include: {
                    owner: { select: { id: true, email: true, name: true } },
                    collaborators: {
                        where: { userId },
                        select: { role: true, joinedAt: true }
                    },
                    _count: { select: { workspaces: true, collaborators: true } }
                },
                orderBy: { updatedAt: 'desc' }
            })
        ]);

        return {
            owned,
            collaborating: collaborating.map(p => ({
                ...p,
                role: p.collaborators[0]?.role,
                joinedAt: p.collaborators[0]?.joinedAt
            }))
        };
    }

    async update(projectId: string, input: UpdateProjectInput) {
        const project = await prisma.project.update({
            where: { id: projectId },
            data: input,
            include: { owner: { select: { id: true, email: true, name: true } } }
        });

        // Invalidate cache
        await redis.del(`project:${projectId}`);
        return project;
    }

    async delete(projectId: string) {
        await prisma.project.delete({ where: { id: projectId } });
        await redis.del(`project:${projectId}`);

        return { success: true, message: 'Project deleted' };
    }

    async inviteCollaborator(projectId: string, email: string, role: Role = Role.COLLABORATOR) {
        const user = await prisma.user.findUnique({ where: { email } });


        if (user) {
            const existing = await prisma.collaborator.findUnique({
                where: { userId_projectId: { userId: user.id, projectId } }
            });

            if (existing) {
                throw new ApiError(409, 'User is already a collaborator');
            }

            const collaborator = await prisma.collaborator.create({
                data: { userId: user.id, projectId, role },
                include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
            });

            await redis.del(`project:${projectId}`);
            return { collaborator, invited: false };
        }

        // Check for existing pending invitation
        const existingInvite = await prisma.invitation.findUnique({
            where: { projectId_email: { projectId, email } }
        });

        if (existingInvite) {
            // Update expiry if already exists
            const invitation = await prisma.invitation.update({
                where: { id: existingInvite.id },
                data: {
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    role
                }
            });
            return { invitation, invited: true, message: 'Invitation updated' };
        }

        // Create new invitation
        const invitation = await prisma.invitation.create({
            data: {
                email,
                projectId,
                role,
                token: uuidv4(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // Invitation created
        return { invitation, invited: true };
    }

    async updateCollaboratorRole(projectId: string, collaboratorId: string, role: Role) {
        const collaborator = await prisma.collaborator.update({
            where: { id: collaboratorId },
            data: { role },
            include: { user: { select: { id: true, email: true, name: true } } }
        });

        await redis.del(`project:${projectId}`);
        return collaborator;
    }

    async removeCollaborator(projectId: string, collaboratorId: string) {
        await prisma.collaborator.delete({ where: { id: collaboratorId } });
        await redis.del(`project:${projectId}`);
        return { success: true, message: 'Collaborator removed' };
    }

    async getCollaborators(projectId: string) {
        const [collaborators, pendingInvitations] = await Promise.all([
            prisma.collaborator.findMany({
                where: { projectId },
                include: {
                    user: { select: { id: true, email: true, name: true, avatarUrl: true } }
                },
                orderBy: { joinedAt: 'asc' }
            }),
            prisma.invitation.findMany({
                where: {
                    projectId,
                    expiresAt: { gt: new Date() } // Only non-expired invitations
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return {
            collaborators,
            pendingInvitations
        };
    }
}

export default new ProjectService();
