import { findProfile } from '@/modules/identity'
import { checklistItems, isChecklistVisible } from '@/modules/identity/checklist'
import type { ChecklistFacts, ChecklistItem } from '@/modules/identity/checklist'
import { findUserFlags, USER_FLAGS } from '@/modules/identity/repository'
import { getStartedKinds } from '@/modules/progress/service'

/**
 * Сборка списка «Освойся в клубе».
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В МОДУЛЕ
 *
 * Список складывается из ответов трёх модулей: `identity` (фотография,
 * личные отметки), `progress` (что человек открывал), и правил из
 * `identity/checklist.ts`. Складывать ответы нескольких модулей
 * в поведение — работа слоя приложения, а не одного из них
 * ([ADR-0024](../../../../docs/adr/0024-onboarding-in-app-layer.md)).
 *
 * Ровно на этом уже споткнулись на шаге 4.6.1: сервис знакомства звал
 * два чужих модуля, и линтер справедливо это отверг.
 * ─────────────────────────────────────────────────────────────────
 *
 * Все три запроса идут параллельно: они независимы, а список показывается
 * на главной, где важна каждая сотня миллисекунд.
 */
export async function getChecklist(userId: string): Promise<{
  visible: boolean
  items: ChecklistItem[]
  done: number
} | null> {
  const [profile, started, flags] = await Promise.all([
    findProfile(userId),
    getStartedKinds(userId),
    findUserFlags(userId),
  ])

  if (!profile) return null

  const facts: ChecklistFacts = {
    // `avatarUrl` не пуст только при загруженной фотографии: аватар
    // из Telegram в `avatar_id` не попадает, он остаётся в сведениях
    // способа входа. Иначе пункт был бы отмечен у всех с первого входа
    // и ничего бы не значил
    hasOwnAvatar: profile.avatarUrl !== null,
    openedSong: started.songs,
    startedCourse: started.course,
    watchedStream: started.streams,
    openedChat: typeof flags[USER_FLAGS.chatOpenedAt] === 'string',
    hiddenByUser: typeof flags[USER_FLAGS.checklistHiddenAt] === 'string',
  }

  const items = checklistItems(facts)

  return {
    visible: isChecklistVisible(facts),
    items,
    done: items.filter((item) => item.done).length,
  }
}
