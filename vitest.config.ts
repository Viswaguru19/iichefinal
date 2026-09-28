import { defineConfig } from 'vitest/config';
import path from 'path';

const root = path.resolve(__dirname);

export default defineConfig({
    root,
    test: {
        environment: 'node',
        globals: true,
        include: ['__tests__/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': root,
        },
    },
});
