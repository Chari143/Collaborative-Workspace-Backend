// Mock dependencies
jest.mock('../config/redis', () => ({ __esModule: true, default: { get: jest.fn(), del: jest.fn() } }));
jest.mock('../queues/job.queue', () => ({ addJob: jest.fn(), getQueueStats: jest.fn() }));
jest.mock('../models/job.model', () => ({
    Job: { create: jest.fn(), findOne: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn() },
    JobStatus: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed' },
    JobType: { CODE_EXECUTION: 'CODE_EXECUTION', FILE_PROCESSING: 'FILE_PROCESSING' }
}));

import { Job, JobStatus, JobType } from '../models/job.model';
import { addJob } from '../queues/job.queue';
import { JobService } from '../services/job.service';

describe('JobService', () => {
    const jobService = new JobService();

    beforeEach(() => jest.clearAllMocks());

    describe('create', () => {
        it('should create a new job', async () => {
            const newJob = { jobId: 'job-1', type: JobType.CODE_EXECUTION, status: JobStatus.PENDING };
            (Job.create as jest.Mock).mockResolvedValue(newJob);
            (addJob as jest.Mock).mockResolvedValue('job-1');

            const result = await jobService.create('user-1', {
                type: 'CODE_EXECUTION',
                payload: { code: 'console.log("hello")' },
                priority: 5
            });

            expect(result.duplicate).toBe(false);
            expect(result.job.status).toBe('pending');
        });

        it('should return existing job for duplicate idempotency key', async () => {
            const existingJob = { jobId: 'existing-job', idempotencyKey: 'unique-key' };
            (Job.findOne as jest.Mock).mockResolvedValue(existingJob);

            const result = await jobService.create('user-1', {
                type: 'CODE_EXECUTION',
                payload: {},
                priority: 5,
                idempotencyKey: 'unique-key'
            });

            expect(result.duplicate).toBe(true);
        });
    });

    describe('getById', () => {
        it('should return job details', async () => {
            const job = { jobId: 'job-1', status: 'completed' };
            (Job.findOne as jest.Mock).mockResolvedValue(job);

            const result = await jobService.getById('job-1', 'user-1');

            expect(result.jobId).toBe('job-1');
        });

        it('should throw error if job not found', async () => {
            (Job.findOne as jest.Mock).mockResolvedValue(null);

            await expect(jobService.getById('invalid-id', 'user-1')).rejects.toThrow('Job not found');
        });
    });

    describe('cancel', () => {
        it('should cancel a pending job', async () => {
            const job = { jobId: 'job-1', status: JobStatus.PENDING, save: jest.fn() };
            (Job.findOne as jest.Mock).mockResolvedValue(job);

            const result = await jobService.cancel('job-1', 'user-1');

            expect(result.message).toBe('Job cancelled');
            expect(job.status).toBe(JobStatus.FAILED);
        });
    });
});
