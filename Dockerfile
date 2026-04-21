FROM node:20-slim

# Install ALL system dependencies (for canvas and Prisma) in one go
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --no-audit --no-fund

# Copy the rest of the code
COPY . .

# Generate Prisma client with dummy URL
RUN DATABASE_URL="postgresql://localhost:5432/dummy" npx prisma generate

# Build the app
RUN npm run build

EXPOSE 3002

# Run migrations and start
CMD npx prisma db push --accept-data-loss && npm run start:prod
