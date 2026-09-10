FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy all files
COPY . .

# Install dependencies
RUN pnpm install

# Expose port
EXPOSE 5173

# Run development server
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
