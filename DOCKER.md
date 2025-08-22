# Use an official Node.js runtime as a parent image
FROM node:22

# Set the working directory in the container
WORKDIR /app

# Clone the repository
RUN git clone https://github.com/jdkdev/screen.git

# Change to the cloned directory
WORKDIR /app/screen

# Install dependencies
RUN npm install

# Build App
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
