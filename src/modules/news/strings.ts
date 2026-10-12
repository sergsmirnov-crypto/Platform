import type { NewsKind } from './types'

/** Тексты раздела новостей */
export const newsStrings = {
  title: 'Новости клуба',
  description: 'Дайджесты, анонсы и новости клуба',

  /** Подписи видов постов: метка на карточке и фильтр ленты */
  kinds: {
    news: 'Новость',
    digest: 'Дайджест',
    announcement: 'Анонс',
    greeting: 'Поздравление',
  } satisfies Record<NewsKind, string>,
  /** Фильтр ленты: множественное число */
  kindFilters: {
    news: 'Новости',
    digest: 'Дайджесты',
    announcement: 'Анонсы',
    greeting: 'Поздравления',
  } satisfies Record<NewsKind, string>,
  allKinds: 'Все',
  emptyKind: 'Таких постов пока нет',

  discuss: 'Обсудить в чате',
  discussHint: 'Откроется Telegram',
  feedTitle: 'Новости клуба',
  feedAll: 'Все посты',

  empty: 'Новостей пока нет',
  emptyDescription: 'Здесь появятся объявления, итоги челленджей и новости о жизни клуба',

  pinned: 'Закреплено',
  draft: 'Черновик',
  backToList: 'Все новости',
  unknownAuthor: 'Клуб',

  manage: {
    title: 'Новости',
    description: 'Объявления и новости клуба',
    create: 'Новая новость',
    empty: 'Новостей пока нет',
    emptyHint: 'Первая новость — хороший повод рассказать, что платформа заработала',
    edit: 'Редактировать',
    titleField: 'Заголовок',
    excerptField: 'Короткая выжимка',
    excerptHint: 'Одна-две строки для списка. Без неё в списке будет только заголовок',
    pinnedField: 'Закрепить наверху',
    pinnedHint: 'Пост будет первым в ленте и на главной',
    pinnedUntilField: 'До какого дня',
    pinnedUntilHint: 'Включительно. Пусто — пока не снимете',
    kindField: 'Вид поста',
    discussionField: 'Ссылка на обсуждение в Telegram',
    discussionHint:
      'Ссылка на сообщение в ветке чата: в Telegram — «Копировать ссылку». Пусто — кнопка ведёт в чат клуба',
    save: 'Сохранить',
    publish: 'Опубликовать',
    unpublish: 'Снять с публикации',
    saved: 'Сохранено',
    failed: 'Не получилось сохранить. Попробуйте ещё раз',
    noTitle: 'Без заголовка',
  },
} as const
