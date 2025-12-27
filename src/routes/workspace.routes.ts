import { Router, Request, Response, NextFunction } from 'express';
import workspaceService from '../services/workspace.service';
import { authenticate, requireWorkspaceAccess } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createWorkspaceSchema, updateWorkspaceSchema } from '../schemas/validation.schemas';

const router = Router();

/**
 * @swagger
 * /api/v1/workspaces:
 *   post:
 *     summary: Create new workspace
 *     tags: [Workspaces]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, projectId]
 *             properties:
 *               name: { type: string, example: 'Main Workspace' }
 *               description: { type: string }
 *               projectId: { type: string }
 *               meta: { type: object }
 *     responses:
 *       201: { description: Workspace created successfully }
 */
router.post('/', authenticate, validateBody(createWorkspaceSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspace = await workspaceService.create(req.user!.id, req.body);
        res.status(201).json(workspace);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   get:
 *     summary: Get workspace details
 *     tags: [Workspaces]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Workspace ID
 *     responses:
 *       200: { description: Workspace details retrieved }
 */
router.get('/:id', authenticate, requireWorkspaceAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspace = await workspaceService.getById(req.params.id);
        res.json(workspace);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/workspaces/project/{projectId}:
 *   get:
 *     summary: List all workspaces for a project
 *     tags: [Workspaces]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     responses:
 *       200: { description: List of workspaces retrieved }
 */
router.get('/project/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaces = await workspaceService.getByProject(req.params.projectId);
        res.json(workspaces);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   patch:
 *     summary: Update workspace
 *     tags: [Workspaces]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               meta: { type: object }
 *     responses:
 *       200: { description: Workspace updated successfully }
 */
router.patch('/:id', authenticate, requireWorkspaceAccess, validateBody(updateWorkspaceSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspace = await workspaceService.update(req.params.id, req.body);
        res.json(workspace);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/workspaces/{id}:
 *   delete:
 *     summary: Delete workspace
 *     tags: [Workspaces]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Workspace ID
 *     responses:
 *       200: { description: Workspace deleted successfully }
 */
router.delete('/:id', authenticate, requireWorkspaceAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await workspaceService.delete(req.params.id);
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
