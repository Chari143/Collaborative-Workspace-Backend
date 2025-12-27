import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus, JobType } from '../models/job.model';
import { addJob, getQueueStats, jobQueue } from '../queues/job.queue';
import { ApiError } from '../middleware/error.middleware';
import { CreateJobInput } from '../schemas/validation.schemas';

export class JobService {
    async create(userId: string, input: CreateJobInput) {
        const jobId = uuidv4();

        if (input.idempotencyKey) {
            const existing = await Job.findOne({ idempotencyKey: input.idempotencyKey, userId });
            if (existing) return { job: existing, duplicate: true };
        }

        const job = await Job.create({
            jobId,
            type: input.type as JobType,
            status: JobStatus.PENDING,
            payload: input.payload,
            priority: input.priority || 5,
            idempotencyKey: input.idempotencyKey,
            userId,
            maxAttempts: 3
        });

        await addJob({ jobId, type: input.type, payload: input.payload, userId, idempotencyKey: input.idempotencyKey }, input.priority);

        return { job, duplicate: false };
    }

    async getById(jobId: string, userId: string) {
        const job = await Job.findOne({ jobId, userId });
        if (!job) throw new ApiError(404, 'Job not found');
        return job;
    }

    async getAllForUser(userId: string, options: { status?: JobStatus; type?: JobType; limit?: number; offset?: number } = {}) {
        const query: Record<string, unknown> = { userId };
        if (options.status) query.status = options.status;
        if (options.type) query.type = options.type;

        const limit = Math.min(options.limit || 20, 100);
        const offset = options.offset || 0;

        const [jobs, total] = await Promise.all([
            Job.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
            Job.countDocuments(query)
        ]);

        return {
            jobs,
            pagination: { total, limit, offset, hasMore: offset + jobs.length < total }
        };
    }

    async cancel(jobId: string, userId: string) {
        const job = await Job.findOne({ jobId, userId });
        if (!job) throw new ApiError(404, 'Job not found');
        if (job.status !== JobStatus.PENDING) throw new ApiError(400, 'Can only cancel pending jobs');

        // Remove from BullMQ queue
        try {
            const bullJob = await jobQueue.getJob(jobId);
            if (bullJob) {
                await bullJob.remove();
            }
        } catch (error) {
            console.error('Failed to remove job from queue:', error);
        }

        // Update MongoDB status
        job.status = JobStatus.FAILED;
        job.error = 'Cancelled by user';
        job.completedAt = new Date();
        await job.save();

        return { message: 'Job cancelled' };
    }

    async getStats(userId: string) {
        const [userStats, queueStats] = await Promise.all([
            Job.aggregate([{ $match: { userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
            getQueueStats()
        ]);

        const user = userStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {} as Record<string, number>);
        return { user, queue: queueStats };
    }

    async retry(jobId: string, userId: string) {
        const job = await Job.findOne({ jobId, userId });
        if (!job) throw new ApiError(404, 'Job not found');
        if (job.status !== JobStatus.FAILED) throw new ApiError(400, 'Can only retry failed jobs');

        job.status = JobStatus.PENDING;
        job.error = undefined;
        job.result = undefined;
        job.attempts = 0;
        job.startedAt = undefined;
        job.completedAt = undefined;
        await job.save();

        await addJob({ jobId: job.jobId, type: job.type, payload: job.payload as Record<string, unknown>, userId, idempotencyKey: job.idempotencyKey }, job.priority);

        return job;
    }
}

export default new JobService();
