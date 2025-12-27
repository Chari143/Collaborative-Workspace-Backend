import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import authService from '../services/auth.service';

// Mock dependencies
jest.mock('../config/prisma', () => ({
    __esModule: true,
    default: {
        project: { findUnique: jest.fn() },
        collaborator: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() }
    }
}));

jest.mock('../services/auth.service');
jest.mock('../services/project.service');
jest.mock('../services/job.service');
jest.mock('../config/redis', () => ({
    redisPub: { publish: jest.fn() },
    redisSub: { subscribe: jest.fn(), on: jest.fn() },
    default: { get: jest.fn(), setex: jest.fn(), del: jest.fn() }
}));
jest.mock('../config/mongodb', () => ({ connectMongoDB: jest.fn() }));
jest.mock('../queues/job.queue', () => ({ addJob: jest.fn(), getQueueStats: jest.fn() }));

describe('API Integration Tests', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('Auth Endpoints', () => {
        it('POST /auth/register - should accept valid registration', async () => {
            (authService.register as jest.Mock).mockResolvedValue({
                user: { id: '1', email: 'test@test.com' },
                accessToken: 'token',
                refreshToken: 'refresh'
            });

            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email: 'test@test.com', password: 'Password1!', name: 'Test' });

            expect(res.status).toBe(201);
        });

        it('POST /auth/login - should accept valid login', async () => {
            (authService.login as jest.Mock).mockResolvedValue({
                user: { id: '1', email: 'test@test.com' },
                accessToken: 'token',
                refreshToken: 'refresh'
            });

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@test.com', password: 'Password1!' });

            expect(res.status).toBe(200);
        });
    });

    describe('Health Check', () => {
        it('GET /health - should return OK', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });
});
