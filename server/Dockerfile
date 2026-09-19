# ==========================================
# ApplyForge Backend - Production Dockerfile
# ==========================================
FROM node:20-alpine AS production

# Install curl for healthcheck validation
RUN apk add --no-cache curl

# Create application directory
WORKDIR /app

# Ensure proper permissions for non-root node user
RUN chown -R node:node /app

# Copy dependency specifications
COPY --chown=node:node package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY --chown=node:node src/ ./src/

# Switch to unprivileged user
USER node

# Default environment variables
ENV NODE_ENV=production \
    PORT=5000

# Expose backend port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/api/health || exit 1

# Production entrypoint
CMD ["node", "src/index.js"]
