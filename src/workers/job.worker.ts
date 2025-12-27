import { Worker, Job as BullJob } from 'bullmq';
import { Job, JobStatus, JobType } from '../models/job.model';
import { connectMongoDB } from '../config/mongodb';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
};

interface JobData {
    jobId: string;
    type: JobType;
    payload: Record<string, unknown>;
    userId: string;
}

// Simulate different workloads
async function simulateWork(type: JobType, _payload: Record<string, unknown>) {
    // Varies between 500ms and 3s
    const duration = 500 + Math.random() * 2500;
    await new Promise(resolve => setTimeout(resolve, duration));

    // Throw random errors occasionally to test retry logic (1 in 20 chance)
    if (Math.random() < 0.05) {
        throw new Error('Random simulated processing failure');
    }

    switch (type) {
        case JobType.CODE_EXECUTION:
            return {
                output: 'Console output: Process finished with exit code 0',
                memoryUsage: `${Math.floor(Math.random() * 50)}MB`,
                duration: `${Math.floor(duration)}ms`
            };
        case JobType.FILE_PROCESSING:
            return {
                status: 'processed',
                fileSize: '2.4MB',
                checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            };
        case JobType.DATA_ANALYSIS:
            return {
                rowsProcessed: 15420,
                insights: ['Trend A detected', 'Outlier found in row 452']
            };
        case JobType.EXPORT:
            return {
                url: `https://storage.example.com/exports/${Date.now()}.csv`,
                expiry: '24h'
            };
        default:
            return { message: 'Job completed' };
    }
}

async function processJob(job: BullJob<JobData>) {
    const { jobId, type } = job.data;
    console.log(`[${jobId}] Processing ${type}...`);

    try {
        // Update status to processing
        await Job.findOneAndUpdate(
            { jobId },
            {
                status: JobStatus.PROCESSING,
                startedAt: new Date(),
                attempts: job.attemptsMade + 1
            }
        );

        const result = await simulateWork(type, job.data.payload);

        await Job.findOneAndUpdate(
            { jobId },
            { status: JobStatus.COMPLETED, result, completedAt: new Date() }
        );

        console.log(`[${jobId}] Completed successfully`);
        return result;

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${jobId}] Failed: ${message}`);
        // Status update is handled by the 'failed' event listener on the worker
        throw error;
    }
}

const worker = new Worker('jobs', processJob, {
    connection,
    concurrency: 5,
    limiter: {
        max: 10,
        duration: 1000
    }
});

worker.on('failed', async (job, error) => {
    if (job) {
        await Job.findOneAndUpdate(
            { jobId: job.data.jobId },
            {
                status: JobStatus.FAILED,
                error: error.message,
                // Only mark completedAt if we exhausted retries? 
                // Actually, we keep updating it on every failure to show last activity.
                completedAt: new Date()
            }
        );
    }
});

worker.on('error', (err) => console.error('Worker connection error:', err));

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Stopping worker...');
    await worker.close();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function start() {
    try {
        await connectMongoDB();
        console.log('🚀 Job worker ready to process tasks');
    } catch (err) {
        console.error('Failed to connect to resources', err);
        process.exit(1);
    }
}

start();
