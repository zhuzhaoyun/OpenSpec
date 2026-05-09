# Stage 1: Build the application
FROM docker.m.daocloud.io/node:20-alpine AS builder

# Clawith agent configuration (must be available at Vite build time)
ARG VITE_CLAWITH_BASE_URL
ARG VITE_CLAWITH_AGENT_ID
ARG VITE_CLAWITH_EMAIL
ARG VITE_CLAWITH_PASSWORD

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies with domestic npm mirror
RUN npm config set registry https://registry.npmmirror.com && npm install

# Copy the rest of the application code
COPY . .

# Set as ENV for Vite build to pick up
ENV VITE_CLAWITH_BASE_URL=$VITE_CLAWITH_BASE_URL
ENV VITE_CLAWITH_AGENT_ID=$VITE_CLAWITH_AGENT_ID
ENV VITE_CLAWITH_EMAIL=$VITE_CLAWITH_EMAIL
ENV VITE_CLAWITH_PASSWORD=$VITE_CLAWITH_PASSWORD

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM docker.m.daocloud.io/nginx:stable-alpine
WORKDIR /usr/share/nginx/html

# Copy the build output from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY ./docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint for runtime env injection
COPY ./docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]