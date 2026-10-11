/**
 * Тексты раздела «Курс».
 *
 * Рядом с модулем, а не в компонентах: поправить формулировку по просьбе
 * владельца продукта — значит открыть один файл, а не искать строку
 * по всему проекту.
 */
export const courseStrings = {
  title: 'Курс',
  description: 'Последовательный путь от первого аккорда до своей песни',

  map: {
    empty: 'Курс ещё готовится',
    emptyHint: 'Первые модули появятся, когда кураторы их наполнят',
    progress: (percent: number) => `${percent}% пройдено`,
    modulePosition: (current: number, total: number) => `Модуль ${current} из ${total}`,
    remaining: (minutes: number) => `осталось около ${minutes} мин`,
    lessonsCount: (completed: number, total: number) => `${completed} из ${total}`,
    draft: 'Черновик',
    freePreview: 'Открыт всем',
    emptyModule: 'Уроки этого модуля ещё готовятся',
    finished: 'Курс пройден целиком',
  },

  blocks: {
    tip: 'Совет',
    warning: 'Осторожно',
    chords: 'Аккорды',
  },

  lesson: {
    number: (current: number, total: number) => `Урок ${current} из ${total}`,
    previous: 'Предыдущий',
    next: 'Следующий',
    complete: 'Урок пройден',
    completed: 'Пройден',
    undoComplete: 'Снять отметку',
    duration: (minutes: number) => `${minutes} мин`,
    relatedSong: 'Разбор к этому уроку',
    content: 'Конспект',
    materials: 'Материалы урока',
    noVideo: 'Видео к этому уроку нет',
    noVideoHint: 'Возможно, весь урок в конспекте ниже',
    videoLocked: 'Видео доступно по подписке',
    lockedHint: 'Структура урока и конспект остаются открытыми',
    renew: 'Продлить подписку',
    backToCourse: 'К карте курса',
    draft: 'Черновик — участники его не видят',
  },

  /** Тексты управления курсом */
  manage: {
    title: 'Курс',
    description: 'Модули и уроки. Порядок здесь — это порядок прохождения',
    empty: 'В курсе пока нет модулей',
    emptyHint: 'Модуль — это глава курса: «Первые аккорды», «Баррэ»',
    addModule: 'Добавить модуль',
    addLesson: 'Добавить урок',
    moduleTitle: 'Название модуля',
    moduleDescription: 'О чём этот модуль',
    lessonTitle: 'Название урока',
    lessonSummary: 'Что освоит участник',
    lessonMinutes: 'Сколько займёт, минут',
    freePreview: 'Открыть урок без подписки',
    freePreviewHint: 'Участник с истёкшей подпиской сможет его посмотреть',
    publish: 'Опубликовать',
    unpublish: 'Снять с публикации',
    edit: 'Редактировать',
    remove: 'Удалить',
    save: 'Сохранить',
    cancel: 'Отмена',
    moveUp: 'Выше',
    moveDown: 'Ниже',
    lessonsCount: (count: number) => `${count} уроков`,
    noLessons: 'Уроков пока нет',
    openForMembers: 'Открыть глазами участника',
    confirmRemoveModule: (count: number) =>
      count > 0
        ? `Удалить модуль вместе с уроками (${count})? Это нельзя отменить.`
        : 'Удалить пустой модуль?',
    confirmRemoveLesson: 'Удалить урок? Это нельзя отменить.',
    emptyLesson: 'Пусто',
    blocksCount: (count: number) => `${count} блоков`,
    hasVideo: 'Видео',
  },

  errors: {
    notFound: 'Урок не найден',
  },
} as const
