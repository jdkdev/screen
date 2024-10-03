# Tauri + SvelteKit

This template should help get you started developing with Tauri and SvelteKit in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).


## Caprover Deployment

```
# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Clone the repository (using a multi-stage build to avoid unnecessary files)
RUN git clone https://github.com/jdkdev/screen.git

# Install dependencies
RUN npm install

# Build App
RUN npm run build

# Start the application
CMD ["npm", "start"]
```
