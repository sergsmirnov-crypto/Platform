'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { getSession } from '@/modules/identity/current-user'
import {
  createNews,
  getNewsForEditor,
  publishNews,
  removeNews,
  saveNews,
} from '@/modules/news/service'
import { contentBlocksSchema } from '@/shared/blocks'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { announceNews } from '../../../_lib/announce'

/**
 * Точки входа редактора новостей.
 *
 * Здесь — «кто это и что он прислал»; в модуле — «что при этом можно
 * и по каким правилам». То же разделение, что у редакторов разборов,
 * эфиров и курса.
 *
 * Область действия у прав на новости не бывает `own`: новость пишут
 * от лица клуба, а не от своего, и делить их на «мои» и «чужие»
 * значило бы делить сам клуб.
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Новость видна в трёх местах: в управлении, в ленте у участника
 * и на своей странице. Обновлять только редактор — значит показывать
 * куратору свежее там, где он правил, и вчерашнее там, куда он пойдёт
 * проверять результат.
 */
function revalidateNews(slug?: string): void {
  revalidatePath(routes.app.manage.news())
  revalidatePath(routes.app.club.news())
  if (slug) revalidatePath(routes.app.club.newsPost(slug))
}

export const createNewsAction = defineAction({
  name: 'news.create',
  input: z.object({ title: z.string().max(200) }),
  handler: async ({ title }) => {
    const actorId = await actor()
    const id = await createNews(actorId, title)

    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.newsCreate,
      entityType: 'news_post',
      entityId: id,
      entityTitle: title,
    })

    revalidateNews()

    return { id }
  },
})

export const saveNewsAction = defineAction({
  name: 'news.save',
  input: z.object({
    id: z.uuid(),
    title: z.string().max(200),
    excerpt: z.string().max(500).nullable(),
    isPinned: z.boolean(),
    content: contentBlocksSchema,
  }),
  handler: async ({ id, ...patch }) => {
    const actorId = await actor()
    const before = await getNewsForEditor(id)

    await saveNews(actorId, id, patch)

    revalidateNews(before.slug)

    return { saved: true }
  },
})

export const publishNewsAction = defineAction({
  name: 'news.publish',
  input: z.object({ id: z.uuid(), published: z.boolean() }),
  handler: async ({ id, published }) => {
    const actorId = await actor()
    const post = await getNewsForEditor(id)

    await publishNews(actorId, id, published)

    await recordAudit({
      actorId,
      action: published ? AUDIT_ACTIONS.newsPublish : AUDIT_ACTIONS.newsUnpublish,
      entityType: 'news_post',
      entityId: id,
      entityTitle: post.title,
    })

    // Оповещаем только при публикации и только в первый раз: снятая
    // и возвращённая новость не должна приходить людям дважды.
    // Признак первой публикации — отсутствие даты до этого вызова
    if (published && post.publishedAt === null) {
      await announceNews({ title: post.title, slug: post.slug })
    }

    revalidateNews(post.slug)

    return { published }
  },
})

export const deleteNewsAction = defineAction({
  name: 'news.delete',
  input: z.object({ id: z.uuid() }),
  handler: async ({ id }) => {
    const actorId = await actor()
    const post = await getNewsForEditor(id)

    await removeNews(actorId, id)

    // Заголовок сохраняется в журнале: после удаления взять его будет
    // неоткуда, а вопрос «куда делось объявление» задают через неделю
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.newsDelete,
      entityType: 'news_post',
      entityId: id,
      entityTitle: post.title,
    })

    revalidateNews(post.slug)

    return { deleted: true }
  },
})
