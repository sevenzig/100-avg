# 🐳 Docker Quick Start Guide

Get the Wingspan Score Tracker running in Docker in under 5 minutes!

## Prerequisites

- Docker Desktop installed and running
- Git (optional, if cloning the repo)

## 🚀 Quick Start (Development)

1. **Clone/navigate to the project:**
   ```bash
   cd wingspan-score
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Generate a JWT secret:**
   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   
   # Linux/Mac
   openssl rand -base64 32
   
   # Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. **Edit `.env` and add your JWT_SECRET:**
   ```env
   DATABASE_PATH=./database/wingspan.db
   JWT_SECRET=paste-your-generated-secret-here
   NODE_ENV=development
   ```

5. **Start the application:**
   ```bash
   docker-compose up
   ```

6. **Open your browser:**
   - Navigate to `http://localhost:5173`
   - The app is now running with hot-reload enabled!

## 🏭 Production Build

1. **Set up production environment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production JWT_SECRET
   ```

2. **Build and start:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Access the application:**
   - Navigate to `http://localhost:3000`

## 📝 Common Commands

```bash
# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild after code changes
docker-compose build --no-cache
docker-compose up

# Seed database
docker-compose exec app npm run seed

# Access container shell
docker-compose exec app sh
```

## 🆘 Troubleshooting

**Port already in use?**
- Change the port in `docker-compose.yml`: `"5174:5173"`

**Database errors?**
- Ensure `.env` file exists with `JWT_SECRET` set
- Try: `docker-compose down -v && docker-compose up`

**Build fails?**
- Clear Docker cache: `docker system prune -a`
- Rebuild: `docker-compose build --no-cache`

## 📚 More Information

- **Full Docker Guide**: See [DOCKER_README.md](./DOCKER_README.md)
- **Strategy Document**: See [DOCKERIZATION_STRATEGY.md](./DOCKERIZATION_STRATEGY.md)
- **Project Setup**: See [SETUP.md](./SETUP.md)

---

**That's it!** Your application should now be running in Docker. 🎉
