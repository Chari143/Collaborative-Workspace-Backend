import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

jest.mock('../config/redis', () => ({
    redis: { get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
    redisPub: { publish: jest.fn() },
    redisSub: { subscribe: jest.fn(), on: jest.fn() },
    default: { get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() }
}));

afterAll(async () => {
    await new Promise(r => setTimeout(r, 100));
});
