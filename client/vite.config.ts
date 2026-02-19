import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // GitHub Pages base URL will be needed here, usually /{repo-name}/
    // For now we leave it empty or set it to './' for relative paths
    base: './',
})
