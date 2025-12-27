// Mock database and cache
jest.mock('../config/prisma', () => ({
    __esModule: true,
    default: {
        workspace: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        project: { findUnique: jest.fn() }
    }
}));

jest.mock('../config/redis', () => ({
    __esModule: true,
    default: { get: jest.fn(), setex: jest.fn(), del: jest.fn() }
}));

import prisma from '../config/prisma';
import redis from '../config/redis';
import { WorkspaceService } from '../services/workspace.service';

describe('WorkspaceService', () => {
    const workspaceService = new WorkspaceService();

    beforeEach(() => jest.clearAllMocks());

    describe('create', () => {
        it('should create a new workspace', async () => {
            (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'proj-1', ownerId: 'user-1' });
            (prisma.workspace.create as jest.Mock).mockResolvedValue({ id: 'ws-1', name: 'Dev Workspace', projectId: 'proj-1' });

            const result = await workspaceService.create('user-1', { name: 'Dev Workspace', projectId: 'proj-1' });

            expect(result.id).toBe('ws-1');
            expect(result.name).toBe('Dev Workspace');
        });
    });

    describe('getById', () => {
        it('should return cached workspace if available', async () => {
            const cached = { id: 'ws-1', name: 'Cached Workspace' };
            (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cached));

            const result = await workspaceService.getById('ws-1');

            expect(result.name).toBe('Cached Workspace');
            expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
        });

        it('should fetch from database if not cached', async () => {
            const workspace = { id: 'ws-1', name: 'DB Workspace' };
            (redis.get as jest.Mock).mockResolvedValue(null);
            (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(workspace);

            const result = await workspaceService.getById('ws-1');

            expect(result.name).toBe('DB Workspace');
            expect(redis.setex).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('should delete workspace and clear cache', async () => {
            (prisma.workspace.delete as jest.Mock).mockResolvedValue({ id: 'ws-1' });

            await workspaceService.delete('ws-1');

            expect(prisma.workspace.delete).toHaveBeenCalledWith({ where: { id: 'ws-1' } });
            expect(redis.del).toHaveBeenCalled();
        });
    });
});
