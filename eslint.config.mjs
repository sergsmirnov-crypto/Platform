import js from '@eslint/js'
import next from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'

/**
 * Правила проверки кода.
 *
 * Порядок блоков важен: каждый следующий может переопределить предыдущий.
 * Последним всегда идёт prettier — он выключает правила про форматирование,
 * потому что форматированием занимается Prettier, а не ESLint.
 */
export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**', 'next-env.d.ts'],
  },

  js.configs.recommended,
  ...next,

  // ─────────────────────────────────────────────────────────────────
  // TypeScript: правила с доступом к типам.
  // projectService подключает к линтеру компилятор TypeScript, поэтому
  // ESLint видит не только текст кода, но и реальные типы значений.
  // ─────────────────────────────────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Неиспользуемые переменные — ошибка. Исключение: имя начинается с _
      // (осознанно проигнорированный аргумент).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Импорт типов помечается явно: import type { User } from '...'
      // Тогда сборщик выбрасывает типы и не тащит лишний код в браузер.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // console.log, забытый в коде, — частая причина утечки данных в логи.
      // Полноценный логер появится на шаге F6.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Порядок импортов. Убирает бессмысленные конфликты при слиянии веток.
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  // Служебные скрипты запускаются из консоли — вывод в консоль для них
  // не побочный эффект, а способ показать результат человеку.
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Конфигурационные файлы на обычном JavaScript: правила, требующие типов,
  // к ним неприменимы.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // ─────────────────────────────────────────────────────────────────
  // ГРАНИЦЫ АРХИТЕКТУРЫ (docs/ARCHITECTURE.md, «Правило зависимостей»).
  // Зависимости идут только вниз: app → modules → shared.
  // Нарушение — не замечание в code review, а ошибка сборки.
  // ─────────────────────────────────────────────────────────────────
  //
  // Единственное исключение из правила: сборщик схемы базы данных.
  // Это «точка сборки» — файл, который по своей природе обязан знать
  // обо всех модулях, иначе инструмент миграций не увидит таблицы.
  // Исключение сделано ровно для одного файла и никуда не расширяется.
  {
    files: ['src/shared/db/schema.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/db/schema.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/app/*'],
              message:
                'shared/ — это инфраструктура. Она не должна знать о бизнес-модулях и маршрутах.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/app/*'],
              message:
                'ui/ — дизайн-система. Компоненты не знают о бизнес-логике: данные приходят через props.',
            },
          ],
        },
      ],
    },
  },
  // ─────────────────────────────────────────────────────────────────
  // РЕЖИМ «СМОТРЕТЬ КАК УЧАСТНИК».
  // Права в закрытой зоне спрашиваются только через `getViewer`: это
  // единственное место, где применяется маска режима. Страница, обратившаяся
  // к правам напрямую, покажет куратору черновик ровно тогда, когда он
  // проверяет, всё ли видно участнику, — и заметить это по коду невозможно.
  // ─────────────────────────────────────────────────────────────────
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/app/_lib/viewer.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/modules/access',
              importNames: ['can', 'canOn', 'getEffectivePermissions'],
              message:
                'В закрытой зоне права спрашиваются через getViewer() из app/app/_lib/viewer: ' +
                'только там учитывается режим «смотреть как участник». ' +
                'Для проверок используйте viewerCan / viewerCanOn, для защиты действий — requirePermission.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/modules/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Разрешено обращаться к schema.ts чужого модуля: внешние ключи
              // между таблицами по своей природе пересекают границы модулей,
              // база данных — общее пространство. Всё остальное закрыто.
              group: ['@/modules/*/*', '!@/modules/*/schema'],
              message:
                'В чужой модуль — только через его публичный API: import { x } from "@/modules/<имя>". ' +
                'Исключение — schema.ts: внешние ключи между таблицами разрешены.',
            },
          ],
        },
      ],
    },
  },

  prettier,
)
