FROM node:22-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Copy pnpm patches required during installation
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build frontend + server
RUN pnpm build

# Railway provides PORT dynamically
CMD ["sh", "-c", "pnpm start -- --port $PORT"]