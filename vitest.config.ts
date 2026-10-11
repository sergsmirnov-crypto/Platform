import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Понимает алиас @/* из tsconfig.json — импорты в тестах те же, что в коде.
    tsconfigPaths: true,
  },
  test: {
    // Тесты лежат рядом с кодом, который проверяют: slug.ts и slug.test.ts.
    // Так их невозможно потерять и сразу видно, что покрыто, а что нет.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: false,
  },
})
