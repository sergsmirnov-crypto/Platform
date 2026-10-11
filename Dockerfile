# Сборка образа приложения.
#
# Многоэтапная: инструменты сборки остаются в промежуточных слоях
# и в конечный образ не попадают. Результат — около 200 МБ вместо 1,5 ГБ.

# ─────────────────────────────────────────────────────────────
# Этап 1: зависимости
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable pnpm

# Сначала копируем только описание зависимостей. Если оно не менялось,
# Docker переиспользует уже собранный слой и не качает пакеты заново.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────
# Этап 2: сборка
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Связанные правила проверки настроек на этапе сборки не применяются:
# боевые значения появятся только при запуске контейнера.
ENV NEXT_TELEMETRY_DISABLED=1
# Адрес базы — заглушка только для этой команды: подключение к базе
# создаётся при загрузке кода, и без адреса сборка останавливается.
# В образ он не попадает (не ENV), настоящий задаётся при запуске.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build pnpm run build

# ─────────────────────────────────────────────────────────────
# Этап 3: запуск
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Приложение работает от обычного пользователя, а не от root.
# Если в нём найдут уязвимость, ущерб будет ограничен.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# standalone-сборка: только те файлы, которые нужны для работы.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Миграции базы, служебные скрипты и исходники процесса задач нужны
# на боевом сервере: перед запуском новой версии применяются миграции,
# а процесс фоновых задач запускается из того же образа.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

USER nextjs
EXPOSE 3000

# Проверка живости: система развёртывания по ней понимает,
# что контейнер действительно готов принимать посетителей.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
