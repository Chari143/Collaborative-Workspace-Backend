import { Router, Request, Response, NextFunction } from 'express';
import projectService from '../services/project.service';
import { authenticate, requireProjectAccess } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createProjectSchema, updateProjectSchema, inviteCollaboratorSchema, updateRoleSchema } from '../schemas/validation.schemas';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create new project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: 'My Project' }
 *               description: { type: string, example: 'Project description' }
 *     responses:
 *       201: { description: Project created successfully }
 *       401: { description: Unauthorized }
 */
router.post('/', authenticate, validateBody(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await projectService.create(req.user!.id, req.body);
        res.status(201).json(project);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: List projects
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of projects }
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const projects = await projectService.getAllForUser(req.user!.id);
        res.json(projects);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     responses:
 *       200: { description: Project details retrieved }
 *       404: { description: Project not found }
 */
router.get('/:id', authenticate, requireProjectAccess(), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await projectService.getById(req.params.id);
        res.json(project);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   patch:
 *     summary: Update project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Project updated successfully }
 *       404: { description: Project not found }
 */
router.patch('/:id', authenticate, requireProjectAccess(Role.COLLABORATOR), validateBody(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const project = await projectService.update(req.params.id, req.body);
        res.json(project);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     responses:
 *       200: { description: Project deleted successfully }
 *       404: { description: Project not found }
 */
router.delete('/:id', authenticate, requireProjectAccess(Role.OWNER), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await projectService.delete(req.params.id);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}/collaborators:
 *   get:
 *     summary: Get project collaborators and pending invitations
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     responses:
 *       200: { description: Collaborators and pending invitations retrieved }
 */
router.get('/:id/collaborators', authenticate, requireProjectAccess(), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const collaborators = await projectService.getCollaborators(req.params.id);
        res.json(collaborators);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}/collaborators:
 *   post:
 *     summary: Invite collaborator to project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, example: 'user@example.com' }
 *               role: { type: string, enum: [OWNER, COLLABORATOR, VIEWER], example: 'COLLABORATOR' }
 *     responses:
 *       201: { description: Collaborator invited successfully }
 */
router.post('/:id/collaborators', authenticate, requireProjectAccess(Role.OWNER), validateBody(inviteCollaboratorSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await projectService.inviteCollaborator(req.params.id, req.body.email, req.body.role);
        res.status(201).json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}/collaborators/{collaboratorId}:
 *   patch:
 *     summary: Update collaborator role
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *       - in: path
 *         name: collaboratorId
 *         required: true
 *         schema: { type: string }
 *         description: Collaborator ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [OWNER, COLLABORATOR, VIEWER] }
 *     responses:
 *       200: { description: Role updated successfully }
 */
router.patch('/:id/collaborators/:collaboratorId', authenticate, requireProjectAccess(Role.OWNER), validateBody(updateRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await projectService.updateCollaboratorRole(req.params.id, req.params.collaboratorId, req.body.role);
        res.json(result);
    } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/projects/{id}/collaborators/{collaboratorId}:
 *   delete:
 *     summary: Remove collaborator from project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Project ID
 *       - in: path
 *         name: collaboratorId
 *         required: true
 *         schema: { type: string }
 *         description: Collaborator ID
 *     responses:
 *       200: { description: Collaborator removed successfully }
 */
router.delete('/:id/collaborators/:collaboratorId', authenticate, requireProjectAccess(Role.OWNER), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await projectService.removeCollaborator(req.params.id, req.params.collaboratorId);
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
