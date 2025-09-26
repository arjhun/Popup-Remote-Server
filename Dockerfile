# ==== CONFIGURE =====
# Use a Node 22 base image
FROM node:22-alpine 
# Set the working directory to /app inside the container
WORKDIR /app
# Copy app files
COPY . .
# ==== BUILD =====
# Install dependencies (npm ci makes sure the exact versions in the lockfile gets installed)
RUN npm ci 
# ==== RUN =======
# Set the env to "production"
ENV NODE_ENV production
EXPOSE 3005
# Start the app
CMD [ "npm", "start" ]