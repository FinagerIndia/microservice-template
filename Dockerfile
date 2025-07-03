# Use the official Node.js image as a base
FROM node:20.18.1

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and pnpm-lock.yaml (if it exists) to the working directory
COPY package.json ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies using pnpm
RUN pnpm install

# Copy the rest of your application code
COPY . .

# Build the project
RUN pnpm build

# Expose the port your app runs on (adjust if necessary)
EXPOSE 3030

# Command to start your application
CMD ["pnpm", "start"] 