import { defineConfig } from 'vite'

export default defineConfig({
  // Change this to your subdirectory path (e.g., '/quadtree/' or '/projects/quadtree/')
  base: '/quadtree/',
  
  build: {
    // Output directory (default is 'dist')
    outDir: 'dist',
    
    // Generate source maps for debugging (optional, can be false for smaller builds)
    sourcemap: false,
  }
})

