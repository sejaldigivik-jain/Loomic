FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install build + runtime dependencies first. NODE_ENV is intentionally set
# only after `next build`, because Tailwind/TypeScript build tooling lives in
# devDependencies.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
ARG DATABASE_URL=postgresql://socialflow:socialflow@db:5432/socialflow
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate --schema prisma/schema.postgresql.prisma
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --schema prisma/schema.postgresql.prisma && npm run start"]
