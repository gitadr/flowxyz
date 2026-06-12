import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  // Deployed under /01-ground-aerial-link/, so asset URLs must be relative.
  base: "./",
  plugins: [react()],
})
