import mongoose from 'mongoose';

export async function connectMongoDB(): Promise<void> {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative_workspace';
    await mongoose.connect(uri);
    console.log('MongoDB connected');
}
