import { describe, expect, it } from 'vitest'

import { SETTING_DEFAULTS, SETTING_KEYS } from './catalog'
import {
  clubAboutSchema,
  isEditableSetting,
  renewUrlSchema,
  telegramChatsSchema,
} from './validation'

describe('ссылка продления подписки', () => {
  it('пустая ссылка допустима: значит, не задана', () => {
    expect(renewUrlSchema.safeParse('').success).toBe(true)
  })

  it('обычная ссылка принимается', () => {
    expect(renewUrlSchema.safeParse('https://t.me/tribute_bot').success).toBe(true)
  })

  it('прямая ссылка в приложение принимается', () => {
    expect(renewUrlSchema.safeParse('tg://resolve?domain=club').success).toBe(true)
  })

  it('ссылка без протокола отвергается: она ведёт в никуда', () => {
    expect(renewUrlSchema.safeParse('t.me/club').success).toBe(false)
  })

  it('незащищённая ссылка отвергается', () => {
    expect(renewUrlSchema.safeParse('http://t.me/club').success).toBe(false)
  })

  it('исполняемая ссылка отвергается: значение попадает в href', () => {
    expect(renewUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
  })
})

describe('карточки чатов', () => {
  const valid = { title: 'Общий чат', description: 'Здесь общаются', url: 'https://t.me/club' }

  it('заполненная карточка принимается', () => {
    expect(telegramChatsSchema.safeParse([valid]).success).toBe(true)
  })

  it('пустой список допустим', () => {
    expect(telegramChatsSchema.safeParse([]).success).toBe(true)
  })

  it('карточка без названия отвергается: она нарисует пустой прямоугольник', () => {
    expect(telegramChatsSchema.safeParse([{ ...valid, title: '  ' }]).success).toBe(false)
  })

  it('пояснение необязательно', () => {
    const parsed = telegramChatsSchema.safeParse([{ title: 'Чат', url: 'https://t.me/x' }])

    expect(parsed.success).toBe(true)
  })

  it('больше шести карточек не принимается: столько никто не откроет', () => {
    const many = Array.from({ length: 7 }, () => valid)

    expect(telegramChatsSchema.safeParse(many).success).toBe(false)
  })

  it('битая ссылка внутри карточки отвергает весь список', () => {
    expect(telegramChatsSchema.safeParse([valid, { ...valid, url: 'нет' }]).success).toBe(false)
  })
})

describe('страница «О клубе»', () => {
  it('значение по умолчанию проходит собственную проверку', () => {
    const parsed = clubAboutSchema.safeParse(SETTING_DEFAULTS[SETTING_KEYS.clubAbout])

    expect(parsed.success).toBe(true)
  })

  it('без вступления не принимается: страница встретит новичка пустотой', () => {
    const parsed = clubAboutSchema.safeParse({
      intro: '   ',
      points: [],
      steps: [],
      schedule: '',
      questions: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('пустой тезис отвергается', () => {
    const parsed = clubAboutSchema.safeParse({
      intro: 'Клуб',
      points: [{ title: 'Курс', text: '' }],
      steps: [],
      schedule: '',
      questions: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('вопрос без ответа отвергается', () => {
    const parsed = clubAboutSchema.safeParse({
      intro: 'Клуб',
      points: [],
      steps: [],
      schedule: '',
      questions: [{ question: 'Сколько заниматься?', answer: '' }],
    })

    expect(parsed.success).toBe(false)
  })

  it('слишком длинное вступление отвергается', () => {
    const parsed = clubAboutSchema.safeParse({
      intro: 'я'.repeat(601),
      points: [],
      steps: [],
      schedule: '',
      questions: [],
    })

    expect(parsed.success).toBe(false)
  })
})

describe('список правимых настроек', () => {
  it('известные ключи опознаются', () => {
    expect(isEditableSetting(SETTING_KEYS.clubAbout)).toBe(true)
    expect(isEditableSetting(SETTING_KEYS.telegramChats)).toBe(true)
  })

  it('произвольный ключ не принимается: править можно только перечисленное', () => {
    expect(isEditableSetting('users.delete_all')).toBe(false)
  })
})
