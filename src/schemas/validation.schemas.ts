import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
    name: z.string().min(2).max(100)
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1)
});

export const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional()
});

export const updateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional()
});

export const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    projectId: z.string().uuid()
});

export const updateWorkspaceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional()
});

export const inviteCollaboratorSchema = z.object({
    email: z.string().email(),
    role: z.enum(['COLLABORATOR', 'VIEWER']).default('COLLABORATOR')
});

export const updateRoleSchema = z.object({
    role: z.enum(['COLLABORATOR', 'VIEWER'])
});

export const createJobSchema = z.object({
    type: z.enum(['CODE_EXECUTION', 'FILE_PROCESSING', 'DATA_ANALYSIS', 'EXPORT']),
    payload: z.record(z.unknown()),
    priority: z.number().min(1).max(10).default(5),
    idempotencyKey: z.string().optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
