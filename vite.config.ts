import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node24",
    ssr: true,

    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: "index",
    },

    rolldownOptions: {
      external: [/^node:/],
      output: {
        codeSplitting: false,
      },
    },

    minify: "terser", // Terser has better minification than oxc
  },

  ssr: {
    noExternal: true,
  },

  oxc: {
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  },
});
