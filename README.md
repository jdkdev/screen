# Tauri + SvelteKit

This template should help get you started developing with Tauri and SvelteKit in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).


## Caprover Deployment

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
