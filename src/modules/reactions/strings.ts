import type { ReactionKey } from './types'

/** Тексты реакций. Подписи — те же, что у эмодзи в Figma */
export const reactionStrings = {
  labels: {
    heart: 'Сердце',
    like: 'Лайк',
    fire: 'Огонь',
    hundred: '100',
    party: 'Праздник',
    eyes: 'Глаза',
    crown: 'Корона',
    plus_one: '+1',
    rocket: 'Ракета',
    dislike: 'Дизлайк',
  } satisfies Record<ReactionKey, string>,

  add: 'Поставить реакцию',
  picker: 'Выбор реакции',
  /** Подпись счётчика для экранного диктора */
  countLabel: (label: string, count: number, mine: boolean) =>
    `${label}: ${count}${mine ? ', ваша реакция' : ''}`,
  failed: 'Не получилось сохранить реакцию. Попробуйте ещё раз',
} as const
