import { defineConfig } from 'vite';
export default defineConfig({build:{rollupOptions:{input:{home:'index.html',admin:'admin-login.html'}}},server:{host:'0.0.0.0',allowedHosts:true,headers:{'Cache-Control':'no-store'}}});
