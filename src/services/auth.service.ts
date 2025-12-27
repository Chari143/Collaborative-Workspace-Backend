import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import redis from '../config/redis';
import { ApiError } from '../middleware/error.middleware';
import { RegisterInput, LoginInput } from '../schemas/validation.schemas';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

export class AuthService {
    async register(input: RegisterInput) {
        const existing = await prisma.user.findUnique({ where: { email: input.email } });
        if (existing) throw new ApiError(409, 'Email already registered');

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const user = await prisma.user.create({
            data: { email: input.email, password: hashedPassword, name: input.name },
            select: { id: true, email: true, name: true, createdAt: true }
        });

        const tokens = await this.generateTokens(user.id, user.email, user.name);
        return { user, ...tokens };
    }

    async login(input: LoginInput) {
        const user = await prisma.user.findUnique({ where: { email: input.email } });
        if (!user) throw new ApiError(401, 'Invalid credentials');

        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) throw new ApiError(401, 'Invalid credentials');

        const tokens = await this.generateTokens(user.id, user.email, user.name);
        return {
            user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
            ...tokens
        };
    }

    async refreshToken(refreshToken: string) {
        try {
            jwt.verify(refreshToken, JWT_REFRESH_SECRET);

            const stored = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!stored) throw new ApiError(401, 'Invalid refresh token');
            if (stored.expiresAt < new Date()) {
                await prisma.refreshToken.delete({ where: { id: stored.id } });
                throw new ApiError(401, 'Refresh token expired');
            }

            await prisma.refreshToken.delete({ where: { id: stored.id } });
            return this.generateTokens(stored.user.id, stored.user.email, stored.user.name);
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) throw new ApiError(401, 'Invalid refresh token');
            throw error;
        }
    }

    async logout(refreshToken: string, accessToken?: string) {
        // Delete refresh token from database
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });

        // Blacklist the access token if provided
        if (accessToken) {
            // Decode to get expiration time
            const decoded = jwt.decode(accessToken) as { exp: number } | null;
            if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    // Store in blacklist until token would expire
                    await redis.setex(`blacklist:${accessToken}`, ttl, '1');
                }
            }
        }

        return { message: 'Logged out successfully' };
    }

    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, name: true, createdAt: true, updatedAt: true,
                _count: { select: { ownedProjects: true, collaborations: true } }
            }
        });
        if (!user) throw new ApiError(404, 'User not found');
        return user;
    }

    async updateProfile(userId: string, data: { name?: string }) {
        return prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, name: true, updatedAt: true }
        });
    }

    private async generateTokens(userId: string, email: string, name: string) {
        const accessToken = jwt.sign({ userId, email, name }, JWT_SECRET, { expiresIn: '15m' as const });
        const refreshToken = jwt.sign({ userId, email, name, tokenId: uuidv4() }, JWT_REFRESH_SECRET, { expiresIn: '7d' as const });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: { token: refreshToken, userId, expiresAt }
        });

        return { accessToken, refreshToken };
    }
}

export default new AuthService();
