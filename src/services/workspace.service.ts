import prisma from '../config/prisma';
import redis from '../config/redis';
import { ApiError } from '../middleware/error.middleware';
import { CreateWorkspaceInput, UpdateWorkspaceInput } from '../schemas/validation.schemas';

const CACHE_TTL = 300;

export class WorkspaceService {
    async create(userId: string, input: CreateWorkspaceInput) {
        const project = await prisma.project.findUnique({
            where: { id: input.projectId },
            include: { collaborators: { where: { userId } } }
        });

        if (!project) throw new ApiError(404, 'Project not found');
        if (project.ownerId !== userId && project.collaborators.length === 0) {
            throw new ApiError(403, 'Access denied');
        }

        return prisma.workspace.create({
            data: { name: input.name, description: input.description, projectId: input.projectId },
            include: { project: { select: { id: true, name: true } } }
        });
    }

    async getById(workspaceId: string) {
        const cached = await redis.get(`workspace:${workspaceId}`);
        if (cached) return JSON.parse(cached);

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { project: { select: { id: true, name: true, ownerId: true } } }
        });

        if (!workspace) throw new ApiError(404, 'Workspace not found');

        await redis.setex(`workspace:${workspaceId}`, CACHE_TTL, JSON.stringify(workspace));
        return workspace;
    }

    async getByProject(projectId: string) {
        return prisma.workspace.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async update(workspaceId: string, input: UpdateWorkspaceInput) {
        const workspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: input,
            include: { project: { select: { id: true, name: true } } }
        });
        await redis.del(`workspace:${workspaceId}`);
        return workspace;
    }

    async delete(workspaceId: string) {
        await prisma.workspace.delete({ where: { id: workspaceId } });
        await redis.del(`workspace:${workspaceId}`);
        return { message: 'Workspace deleted' };
    }
}

export default new WorkspaceService();
