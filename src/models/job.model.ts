import mongoose, { Schema, Document } from 'mongoose';

export enum JobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export enum JobType {
    CODE_EXECUTION = 'CODE_EXECUTION',
    FILE_PROCESSING = 'FILE_PROCESSING',
    DATA_ANALYSIS = 'DATA_ANALYSIS',
    EXPORT = 'EXPORT'
}

export interface IJob extends Document {
    jobId: string;
    type: JobType;
    status: JobStatus;
    payload: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
    attempts: number;
    maxAttempts: number;
    priority: number;
    idempotencyKey?: string;
    userId: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

const jobSchema = new Schema<IJob>({
    jobId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: Object.values(JobType), required: true },
    status: { type: String, enum: Object.values(JobStatus), default: JobStatus.PENDING },
    payload: { type: Schema.Types.Mixed, required: true },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    priority: { type: Number, default: 5, min: 1, max: 10 },
    idempotencyKey: { type: String, sparse: true, index: true },
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
}, { timestamps: true });

jobSchema.index({ userId: 1, status: 1 });
jobSchema.index({ status: 1, createdAt: 1 });

export const Job = mongoose.model<IJob>('Job', jobSchema);
