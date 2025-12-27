import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import redis from '../config/redis';
import { ApiError } from './error.middleware';
import { Role } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            user?: { id: string; email: string; name: string };
            projectRole?: Role;
        }
    }
}

interface JwtPayload {
    userId: string;
    email: string;
    name: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new ApiError(401, 'No token provided');
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;

        // Check if token has been blacklisted
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            throw new ApiError(401, 'Token has been invalidated');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true }
        });

        if (!user) throw new ApiError(401, 'User not found');

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new ApiError(401, 'Invalid token'));
            return;
        }
        next(error);
    }
}

export function requireProjectAccess(minRole: Role = Role.VIEWER) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.id;
            const projectId = req.params.projectId || req.params.id;

            if (!userId) throw new ApiError(401, 'Auth required');
            if (!projectId) throw new ApiError(400, 'Project ID required');

            const project = await prisma.project.findUnique({
                where: { id: projectId },
                select: { ownerId: true }
            });

            if (!project) throw new ApiError(404, 'Project not found');

            if (project.ownerId === userId) {
                req.projectRole = Role.OWNER;
                return next();
            }

            const collaborator = await prisma.collaborator.findUnique({
                where: { userId_projectId: { userId, projectId } },
                select: { role: true }
            });

            if (!collaborator) throw new ApiError(403, 'Access denied');

            const hierarchy = { OWNER: 3, COLLABORATOR: 2, VIEWER: 1 };
            if (hierarchy[collaborator.role] < hierarchy[minRole]) {
                throw new ApiError(403, 'Insufficient permissions');
            }

            req.projectRole = collaborator.role;
            next();
        } catch (error) {
            next(error);
        }
    };
}

export async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const workspaceId = req.params.workspaceId || req.params.id;

        if (!userId) throw new ApiError(401, 'Auth required');
        if (!workspaceId) throw new ApiError(400, 'Workspace ID required');

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { project: { select: { ownerId: true } } }
        });

        if (!workspace) throw new ApiError(404, 'Workspace not found');

        if (workspace.project.ownerId === userId) {
            req.projectRole = Role.OWNER;
            return next();
        }

        const collaborator = await prisma.collaborator.findUnique({
            where: { userId_projectId: { userId, projectId: workspace.projectId } },
            select: { role: true }
        });

        if (!collaborator) throw new ApiError(403, 'Access denied');

        req.projectRole = collaborator.role;
        next();
    } catch (error) {
        next(error);
    }
}
