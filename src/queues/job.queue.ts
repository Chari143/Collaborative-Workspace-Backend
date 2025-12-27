import { Queue } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
};

export const jobQueue = new Queue('jobs', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 }
    }
});

interface JobData {
    jobId: string;
    type: string;
    payload: Record<string, unknown>;
    userId: string;
    idempotencyKey?: string;
}

export async function addJob(data: JobData, priority = 5): Promise<string> {
    const job = await jobQueue.add(data.type, data, { priority, jobId: data.jobId });
    return job.id || data.jobId;
}

export async function getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
        jobQueue.getWaitingCount(),
        jobQueue.getActiveCount(),
        jobQueue.getCompletedCount(),
        jobQueue.getFailedCount()
    ]);
    return { waiting, active, completed, failed };
}
