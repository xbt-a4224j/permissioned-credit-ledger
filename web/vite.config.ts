// #2 Vite config — React plugin + fixed WEB port from CLAUDE.md (51730).
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

export default defineConfig({
  plugins: [react()],
  server: {port: 51730},
  preview: {port: 51730},
});
