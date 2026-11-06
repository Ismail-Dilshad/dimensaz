import {defineConfig} from 'vitest/config';
export default defineConfig({test:{setupFiles:['tests/test-cleanup.ts'],include:['tests/**/*.test.ts'],fileParallelism:false}});
