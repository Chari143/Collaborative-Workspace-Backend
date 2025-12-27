# Collaborative Workspace Backend

A backend service for real-time collaborative workspaces - think of it like a simplified version of what powers collaborative coding platforms.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Client Apps                              │
├──────────────────────────────────────────────────────────────┤
│  REST API (Express)     WebSocket (Socket.io)      Swagger   │
├──────────────────────────────────────────────────────────────┤
│                    Service Layer                              │
│    Auth  │  Projects  │  Workspaces  │  Jobs                 │
├──────────────────────────────────────────────────────────────┤
│  PostgreSQL   │   MongoDB    │   Redis    │   BullMQ         │
│   (users)     │   (jobs)     │  (cache)   │   (queue)        │
└──────────────────────────────────────────────────────────────┘
```

The app follows a layered architecture:
- **Routes** handle HTTP requests and validation
- **Services** contain business logic
- **Prisma/Mongoose** manage database operations
- **Redis** handles caching and real-time event distribution

## Setup & Run Instructions

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)

### Quick Start

```bash
# Clone and start everything
git clone <repository-url>
cd collaborative-workspace-backend
docker-compose up -d

# That's it! The API is now running at http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

### Running Tests

```bash
npm test
```

## API Documentation

Once the server is running, visit `http://localhost:3000/api-docs` for the full Swagger documentation.

### Main Endpoints

| Category | Endpoints |
|----------|-----------|
| Auth | `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh` |
| Projects | `/api/v1/projects`, `/api/v1/projects/:id/collaborators` |
| Workspaces | `/api/v1/workspaces`, `/api/v1/workspaces/project/:projectId` |
| Jobs | `/api/v1/jobs`, `/api/v1/jobs/:id/cancel`, `/api/v1/jobs/:id/retry` |

## Design Decisions and Trade-offs

### Why Multiple Databases?

I went with a polyglot persistence approach:

- **PostgreSQL** for users, projects, and relationships - these need ACID transactions and referential integrity
- **MongoDB** for job data - jobs are essentially documents with flexible schemas and don't need strict relations
- **Redis** for caching and the job queue - it's fast and works great with BullMQ

The trade-off is operational complexity (3 databases to maintain), but it lets each database do what it does best.

### JWT Strategy

I'm using short-lived access tokens (15 minutes) with longer refresh tokens (7 days). The access token is never stored server-side, which makes the system stateless. The refresh token is stored in PostgreSQL so we can invalidate sessions if needed.

When a user logs out, we blacklist the access token in Redis until it expires. This prevents the token from being used even though JWTs are normally stateless.

### Real-time with Redis Pub/Sub

For WebSocket events, I used Redis Pub/Sub instead of just local event emitters. This means if you scale to multiple server instances, events still reach everyone. When User A makes a change on Server 1, Redis broadcasts it to Server 2 where User B is connected.

### Job Processing

Jobs use an idempotency key so the same job won't run twice if there's a network retry. The worker has a 5% random failure rate built-in for testing retry logic - in production you'd obviously remove that.

BullMQ handles retries automatically with exponential backoff (3 attempts).

### Rate Limiting

Auth endpoints have stricter limits (10 requests per 15 minutes) compared to regular endpoints (100 requests per 15 minutes). This helps prevent brute force attacks while not affecting normal usage.

## Scalability Considerations

### Horizontal Scaling

The app is designed to run multiple instances behind a load balancer:

- **Stateless API servers** - No session storage in memory, everything in Redis/Postgres
- **Redis Pub/Sub** - WebSocket events sync across instances
- **Connection pooling** - Prisma handles database connection pooling automatically

### What I'd add for production scale

1. **Database read replicas** - Route read-heavy queries to replicas
2. **Redis Cluster** - For high availability and more memory
3. **CDN** - For static assets and API caching at the edge
4. **Kubernetes** - For auto-scaling based on CPU/memory
5. **Message queue partitioning** - If job volume gets very high

### Current bottlenecks

- PostgreSQL is the main bottleneck for write-heavy workloads
- The job worker runs on a single process (could be scaled with multiple workers)
- No pagination on some list endpoints yet

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# MongoDB
MONGODB_URI=mongodb://localhost:27017/collab

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Server
PORT=3000
NODE_ENV=development
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- auth.service.test.ts
```

Test coverage includes:
- Unit tests for services (auth, project, workspace, job)
- Integration tests for API endpoints

## Project Structure

```
src/
├── config/          # Database and Redis setup
├── middleware/      # Auth, validation, rate limiting
├── models/          # MongoDB schemas
├── queues/          # BullMQ job queue
├── routes/          # Express routes with Swagger docs
├── schemas/         # Zod validation schemas
├── services/        # Business logic
├── tests/           # Unit and integration tests
├── websocket/       # Socket.io implementation
└── workers/         # Background job processors
```

---

Built for the PurpleMerit Backend Developer Assessment
