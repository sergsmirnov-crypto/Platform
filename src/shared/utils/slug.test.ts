import { describe, expect, it } from 'vitest'

import { slugify } from './slug'

describe('slugify', () => {
  it('переводит кириллицу в латиницу', () => {
    expect(slugify('Кино — Перемен')).toBe('kino-peremen')
  })

  it('оставляет латиницу как есть', () => {
    expect(slugify('Nothing Else Matters')).toBe('nothing-else-matters')
  })

  it('убирает диакритику', () => {
    expect(slugify('Café del Mar')).toBe('cafe-del-mar')
  })

  it('схлопывает разделители и обрезает края', () => {
    expect(slugify('  Linkin Park -- Numb!!  ')).toBe('linkin-park-numb')
  })

  it('не оставляет дефис на конце после обрезки по длине', () => {
    const result = slugify('a'.repeat(79) + ' bbb')
    expect(result.endsWith('-')).toBe(false)
    expect(result.length).toBeLessThanOrEqual(80)
  })

  it('возвращает пустую строку, если полезных символов нет', () => {
    expect(slugify('!!! ???')).toBe('')
  })
})
