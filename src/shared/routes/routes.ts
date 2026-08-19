/**
 * Реестр адресов страниц — единственный источник истины по URL проекта.
 *
 * Зачем это нужно вместо строк прямо в коде:
 *
 * 1. Переименовать раздел («Разборы» → «Библиотека») можно правкой одного
 *    файла, а не поиском по всему проекту.
 * 2. Опечатка в адресе становится ошибкой сборки, а не битой ссылкой,
 *    которую заметит участник клуба.
 * 3. Открыв этот файл, новый разработчик видит карту всего продукта.
 *
 * Правило: в компонентах и модулях адреса пишутся ТОЛЬКО через `routes`.
 * Строковых литералов вида '/app/learn/songs' в коде быть не должно.
 */

export const routes = {
  /** Лендинг и экран входа */
  home: () => '/',

  auth: {
    /** Возврат из виджета Telegram после входа */
    telegram: () => '/auth/telegram',
  },

  legal: {
    offer: () => '/legal/offer',
    privacy: () => '/legal/privacy',
    contacts: () => '/legal/contacts',
  },

  /** Закрытая зона. Всё, что внутри, требует активной сессии. */
  app: {
    dashboard: () => '/app',
    onboarding: () => '/app/onboarding',
    search: () => '/app/search',
    subscriptionExpired: () => '/app/subscription/expired',

    learn: {
      index: () => '/app/learn',
      songs: () => '/app/learn/songs',
      song: (slug: string) => `/app/learn/songs/${slug}`,
      rehearse: (slug: string) => `/app/learn/songs/${slug}/rehearse`,
      course: () => '/app/learn/course',
      courseModule: (moduleSlug: string) => `/app/learn/course/${moduleSlug}`,
      lesson: (moduleSlug: string, lessonSlug: string) =>
        `/app/learn/course/${moduleSlug}/${lessonSlug}`,
    },

    streams: {
      index: () => '/app/streams',
      upcoming: () => '/app/streams/upcoming',
      stream: (slug: string) => `/app/streams/${slug}`,
    },

    club: {
      index: () => '/app/club',
      about: () => '/app/club/about',
      curators: () => '/app/club/curators',
      curator: (slug: string) => `/app/club/curators/${slug}`,
      members: () => '/app/club/members',
      /**
       * Визитка участника — по идентификатору, а не по адресному имени.
       *
       * Адресное имя пришлось бы собирать из имени человека, а имя
       * в профиле правят: ссылка ломалась бы у всех, кому её отправили.
       * Для страницы, которую открывают из списка, читаемость адреса
       * ничего не стоит
       */
      member: (userId: string) => `/app/club/members/${userId}`,
      news: () => '/app/club/news',
      newsPost: (slug: string) => `/app/club/news/${slug}`,
      telegram: () => '/app/club/telegram',
    },

    me: {
      index: () => '/app/me',
      profile: () => '/app/me/profile',
      progress: () => '/app/me/progress',
      favorites: () => '/app/me/favorites',
      notes: () => '/app/me/notes',
      notifications: () => '/app/me/notifications',
      settings: () => '/app/me/settings',
    },

    /**
     * Управление. Не отдельная админка, а раздел платформы:
     * появляется в меню только при наличии соответствующих прав (PRD v0.3).
     */
    manage: {
      index: () => '/app/manage',
      songs: () => '/app/manage/songs',
      song: (id: string) => `/app/manage/songs/${id}`,
      newSong: () => '/app/manage/songs/new',
      /** Экран массовой разметки материалов, перенесённых из Telegram */
      migration: () => '/app/manage/migration',
      streams: () => '/app/manage/streams',
      stream: (id: string) => `/app/manage/streams/${id}`,
      newStream: () => '/app/manage/streams/new',
      course: () => '/app/manage/course',
      news: () => '/app/manage/news',
      newsPost: (id: string) => `/app/manage/news/${id}`,
      media: () => '/app/manage/media',
      curators: () => '/app/manage/curators',
      curator: (userId: string) => `/app/manage/curators/${userId}`,
      team: () => '/app/manage/team',
      members: () => '/app/manage/members',
      member: (userId: string) => `/app/manage/members/${userId}`,
      subscriptions: () => '/app/manage/subscriptions',
      settings: () => '/app/manage/settings',
      logs: () => '/app/manage/logs',
    },
  },

  /**
   * Адреса, отвечающие не страницей.
   *
   * Их немного и будет немного: почти всё в проекте делается серверными
   * действиями. Обработчик адреса появляется там, где нужен ответ,
   * которого действие дать не может, — перенаправление на файл
   * или ответ внешней системе (API.md).
   */
  api: {
    /** Скачивание материала: проверка прав и переход на подписанный адрес */
    mediaDownload: (assetId: string) => `/api/media/${assetId}/download`,
    /** Показ материала в браузере: табы рядом с видео (шаг 10.6) */
    mediaView: (assetId: string) => `/api/media/${assetId}/view`,
    /**
     * Загрузка материала куратором.
     *
     * Обработчик адреса, а не действие сервера: у действий есть предел
     * размера тела запроса и нет прогресса, а куратор льёт партитуру
     * на двадцать мегабайт (API.md, «Загрузка материала»)
     */
    mediaUpload: (target: { entityType: string; entityId: string }) =>
      `/api/media/upload?entityType=${encodeURIComponent(target.entityType)}&entityId=${encodeURIComponent(target.entityId)}`,
    /**
     * Файл календаря с анонсом эфира.
     *
     * Тоже обработчик адреса: браузер должен получить файл по обычной
     * ссылке и отдать его календарю. Действие сервера вернуло бы данные
     * в JavaScript, откуда файл пришлось бы собирать руками
     */
    streamCalendar: (slug: string) => `/api/streams/${slug}/calendar`,
  },

  /**
   * Служебные страницы для разработки.
   * В производственной сборке отвечают 404.
   */
  dev: {
    routes: () => '/dev/routes',
    ui: () => '/dev/ui',
    login: () => '/dev/login',
  },
} as const
