import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode=single 产出可双击运行的单文件 HTML（离线包）
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
      target: 'es2020',
      rollupOptions: single ? { output: { inlineDynamicImports: true } } : {},
    },
  };
});
