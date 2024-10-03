import '@unocss/reset/tailwind-compat.css'
import 'virtual:uno.css'
import './app.css'
import App from './App.svelte'
// import { TrayIcon } from '@tauri-apps/api/tray';
// import { Menu } from '@tauri-apps/api/menu';

// if (window.__TAURI_INTERNALS__) {
// const menu = await Menu.new({
//   items: [
//     {
//       id: 'start',
//       text: 'Take Screenshot',
//     },
//     {
//       id: 'start',
//       text: 'Open Launcher',
//     },
//     {
//       id: 'start',
//       text: 'Configuration',
//     },
//     {
//       id: 'quit',
//       text: 'Quit',
//     },
//   ],
// })

// const options = {
//   menu,
//   menuOnLeftClick: true,
// }

// const tray = TrayIcon.new(options)

// }

const app = new App({
  target: document.getElementById('app'),
})

export default app
