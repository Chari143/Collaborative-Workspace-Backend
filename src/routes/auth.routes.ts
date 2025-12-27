import { Router, Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../schemas/validation.schemas';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               name: { type: string }
 *     responses:
 *       201: { description: User created }
 */
router.post('/register', authRateLimiter, validateBody(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.register(req.body);
        res.status(201).json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 */
router.post('/login', authRateLimiter, validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.login(req.body);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Token refreshed }
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.refreshToken(req.body.refreshToken);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, description: Refresh token to invalidate }
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authenticate, validateBody(refreshTokenSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {

        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        const result = await authService.logout(req.body.refreshToken, accessToken);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile }
 */
router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.getProfile(req.user!.id);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/auth/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: New Name }
 *               avatarUrl: { type: string, example: https://example.com/avatar.jpg }
 *     responses:
 *       200: { description: Profile updated successfully }
 */
router.patch('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.updateProfile(req.user!.id, req.body);
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
