import bcrypt from 'bcrypt';

// Mock database
jest.mock('../config/prisma', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn(), create: jest.fn() },
        refreshToken: { create: jest.fn(), deleteMany: jest.fn() }
    }
}));

import prisma from '../config/prisma';
import { AuthService } from '../services/auth.service';

describe('AuthService', () => {
    const authService = new AuthService();

    beforeEach(() => jest.clearAllMocks());

    describe('register', () => {
        it('should create a new user and return tokens', async () => {
            const newUser = { id: 'user-1', email: 'john@example.com', name: 'John', createdAt: new Date() };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.create as jest.Mock).mockResolvedValue(newUser);
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

            const result = await authService.register({
                email: 'john@example.com',
                password: 'SecurePass123',
                name: 'John'
            });

            expect(result.user.email).toBe('john@example.com');
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
        });

        it('should reject if email is already taken', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-user' });

            await expect(
                authService.register({ email: 'taken@example.com', password: 'Pass123', name: 'Test' })
            ).rejects.toThrow('Email already registered');
        });
    });

    describe('login', () => {
        it('should return tokens for valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('MyPassword123', 10);
            const user = { id: 'user-1', email: 'jane@example.com', password: hashedPassword, name: 'Jane', createdAt: new Date() };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
            (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

            const result = await authService.login({ email: 'jane@example.com', password: 'MyPassword123' });

            expect(result.accessToken).toBeDefined();
            expect(result.user.email).toBe('jane@example.com');
        });

        it('should reject invalid credentials', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(
                authService.login({ email: 'wrong@example.com', password: 'wrongpass' })
            ).rejects.toThrow('Invalid credentials');
        });
    });
});
