# Docker Setup for Checklist System

This Docker Compose configuration runs the complete Checklist System stack including:
- PostgreSQL database
- Redis cache
- Backend API (NestJS)
- Frontend application (Next.js)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

1. **Navigate to the docker directory:**
   ```bash
   cd docker
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

   Or run in detached mode:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3006
   - Backend API: http://localhost:3005/api/v1
   - API Documentation: http://localhost:3005/api/v1/docs

## Demo Account

The system automatically seeds a demo admin account on first startup:

- **Email:** `admin@checklist.local`
- **Password:** `Admin@123456`

⚠️ **Important:** Change this password after first login in production!

## Services

### PostgreSQL (Port 5432)
- Database: `checklist_system`
- User: `checklist_user`
- Password: `checklist_dev_password` (configurable in `.env`)

### Redis (Port 6379)
- Password: `redis_dev_password` (configurable in `.env`)

### Backend (Port 3005)
- Automatically runs database migrations on startup
- Seeds demo data if database is empty
- Health check endpoint: `/api/v1/health`

### Frontend (Port 3006)
- Next.js production build
- Connects to backend API

## Environment Variables

Edit `docker/.env` to customize:

```bash
DB_NAME=checklist_system
DB_USER=checklist_user
DB_PASSWORD=checklist_dev_password
DB_PORT=5432
REDIS_PORT=6379
REDIS_PASSWORD=redis_dev_password
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

## Docker Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes all data)
```bash
docker-compose down -v
```

### Rebuild specific service
```bash
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Access container shell
```bash
# Backend
docker exec -it checklist_backend sh

# Frontend
docker exec -it checklist_frontend sh

# Database
docker exec -it checklist_db psql -U checklist_user -d checklist_system
```

## Troubleshooting

### Backend fails to start
1. Check if database is healthy:
   ```bash
   docker-compose ps
   ```

2. View backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Ensure database migrations completed:
   ```bash
   docker exec -it checklist_backend npx prisma migrate status
   ```

### Frontend can't connect to backend
1. Verify backend is running and healthy:
   ```bash
   curl http://localhost:3005/api/v1/health
   ```

2. Check CORS configuration in backend environment

### Database connection issues
1. Ensure PostgreSQL is healthy:
   ```bash
   docker-compose ps postgres
   ```

2. Test database connection:
   ```bash
   docker exec -it checklist_db pg_isready -U checklist_user
   ```

### Reset everything
```bash
# Stop all containers and remove volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all

# Rebuild and start fresh
docker-compose up --build
```

## Development vs Production

This configuration is optimized for development. For production:

1. Change all default passwords in `.env`
2. Use strong JWT_SECRET and ENCRYPTION_KEY
3. Configure proper CORS origins
4. Set up SSL/TLS certificates
5. Use external database and Redis services
6. Configure proper backup strategies
7. Set up monitoring and logging

## Data Persistence

Data is persisted in Docker volumes:
- `postgres_data`: Database files
- `redis_data`: Redis persistence
- `backend_uploads`: Uploaded files

These volumes persist even when containers are stopped.

## Network

All services communicate through the `checklist_network` bridge network.
