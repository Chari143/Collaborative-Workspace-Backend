import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
    console.error('Error:', error.message);

    if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
    }

    if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: error });
        return;
    }

    res.status(500).json({ error: 'Internal server error' });
}
