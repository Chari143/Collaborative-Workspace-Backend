// Mock database and cache
jest.mock('../config/prisma', () => ({
    __esModule: true,
    default: {
        project: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        collaborator: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        user: { findUnique: jest.fn() },
        invitation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() }
    }
}));

jest.mock('../config/redis', () => ({
    __esModule: true,
    default: { get: jest.fn(), setex: jest.fn(), del: jest.fn() }
}));

import prisma from '../config/prisma';
import redis from '../config/redis';
import { ProjectService } from '../services/project.service';

describe('ProjectService', () => {
    const projectService = new ProjectService();

    beforeEach(() => jest.clearAllMocks());

    describe('create', () => {
        it('should create a new project', async () => {
            const project = { id: 'proj-1', name: 'My Project', ownerId: 'user-1', owner: { id: 'user-1', email: 'owner@example.com', name: 'Owner' } };
            (prisma.project.create as jest.Mock).mockResolvedValue(project);

            const result = await projectService.create('user-1', { name: 'My Project' });

            expect(result.name).toBe('My Project');
            expect(result.ownerId).toBe('user-1');
        });
    });

    describe('getById', () => {
        it('should return cached project if available', async () => {
            const cachedProject = { id: 'proj-1', name: 'Cached Project' };
            (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedProject));

            const result = await projectService.getById('proj-1');

            expect(result.name).toBe('Cached Project');
            expect(prisma.project.findUnique).not.toHaveBeenCalled();
        });

        it('should fetch from database and cache if not in cache', async () => {
            const dbProject = { id: 'proj-1', name: 'DB Project', owner: {}, workspaces: [], collaborators: [] };
            (redis.get as jest.Mock).mockResolvedValue(null);
            (prisma.project.findUnique as jest.Mock).mockResolvedValue(dbProject);

            const result = await projectService.getById('proj-1');

            expect(result.name).toBe('DB Project');
            expect(redis.setex).toHaveBeenCalled();
        });

        it('should throw error if project not found', async () => {
            (redis.get as jest.Mock).mockResolvedValue(null);
            (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(projectService.getById('invalid-id')).rejects.toThrow('Project not found');
        });
    });

    describe('inviteCollaborator', () => {
        it('should create invitation for non-registered user', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.invitation.create as jest.Mock).mockResolvedValue({ token: 'invite-token' });

            const result = await projectService.inviteCollaborator('proj-1', 'newuser@example.com');

            expect(result.invited).toBe(true);
            expect(prisma.invitation.create).toHaveBeenCalled();
        });

        it('should update existing invitation', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({ id: 'inv-1' });
            (prisma.invitation.update as jest.Mock).mockResolvedValue({ id: 'inv-1' });

            const result = await projectService.inviteCollaborator('proj-1', 'pending@example.com');

            expect(result.invited).toBe(true);
            expect(result.message).toBe('Invitation updated');
        });
    });
});
