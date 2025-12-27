import { Router, Request, Response, NextFunction } from 'express';
import jobService from '../services/job.service';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createJobSchema } from '../schemas/validation.schemas';
import { JobStatus, JobType } from '../models/job.model';

const router = Router();

/**
 * @swagger
 * /api/v1/jobs:
 *   post:
 *     summary: Create new background job
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, payload]
 *             properties:
 *               type: { type: string, enum: [CODE_EXECUTION, FILE_PROCESSING, DATA_ANALYSIS, EXPORT], example: CODE_EXECUTION }
 *               payload: { type: object, example: { code: 'console.log("test")', language: 'javascript' } }
 *               priority: { type: integer, minimum: 1, maximum: 10, example: 5 }
 *     responses:
 *       201: { description: Job created successfully }
 */
router.post('/', authenticate, validateBody(createJobSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await jobService.create(req.user!.id, req.body);
        res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/jobs:
 *   get:
 *     summary: List jobs
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of jobs }
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const options = {
            status: req.query.status as JobStatus,
            type: req.query.type as JobType,
            limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
        };
        const result = await jobService.getAllForUser(req.user!.id, options);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/jobs/stats:
 *   get:
 *     summary: Get job stats
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Job statistics }
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await jobService.getStats(req.user!.id);
        res.json(stats);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Job ID
 *     responses:
 *       200: { description: Job details retrieved }
 *       404: { description: Job not found }
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await jobService.getById(req.params.id, req.user!.id);
        res.json(job);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/jobs/{id}/cancel:
 *   post:
 *     summary: Cancel pending or running job
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Job ID
 *     responses:
 *       200: { description: Job cancelled successfully }
 *       400: { description: Job cannot be cancelled }
 */
router.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await jobService.cancel(req.params.id, req.user!.id);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/jobs/{id}/retry:
 *   post:
 *     summary: Retry failed job
 *     tags: [Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Job ID
 *     responses:
 *       200: { description: Job retried successfully }
 *       400: { description: Job cannot be retried }
 */
router.post('/:id/retry', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await jobService.retry(req.params.id, req.user!.id);
        res.json(job);
    } catch (error) { next(error); }
});

export default router;
