/**
 * Формат сообщений коммитов: Conventional Commits.
 * Пример: feat(auth): implement telegram authentication
 *
 * Зачем: по такой истории можно автоматически собирать CHANGELOG
 * и за секунду находить, когда и зачем менялся конкретный модуль.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Области соответствуют модулям проекта (src/modules/*) и слоям инфраструктуры.
    'scope-enum': [
      2,
      'always',
      [
        'repo', // инструменты, конфигурация репозитория
        'app', // маршруты и страницы
        'ui', // дизайн-система
        'db', // схема БД и миграции
        'config', // переменные окружения и настройки
        'core', // общая инфраструктура: логи, ошибки, доступ
        'jobs', // фоновые задачи
        'identity', // пользователи, вход, сессии
        'access', // роли и права
        'subscription', // подписки и Telegram-вебхуки
        'media', // видео и файлы
        'songs', // разборы
        'streams', // эфиры
        'course', // курс
        'news', // новости
        'club', // сообщество и кураторы
        'manage', // экраны управления
        'infra', // окружение разработки: Docker, база, служебные сервисы
        'deploy', // сборка и развёртывание на сервере
        'deps', // обновление зависимостей
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
}

export default config
