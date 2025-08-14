# Tauri + SvelteKit

This template should help get you started developing with Tauri and SvelteKit in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).


## Caprover Deployment

FROM node:18

WORKDIR /app

RUN git clone https://github.com/jdkdev/screen.git

WORKDIR /app/screen

RUN npm install

RUN npm run build

# Debug: Show what npm start would run
RUN npm run start --dry-run || echo "npm start failed"

# Debug: Show package.json scripts
RUN cat package.json | grep -A 10 '"scripts"'

EXPOSE 3000

# Try alternative starts
CMD ["sh", "-c", "cat package.json && npm start"]
