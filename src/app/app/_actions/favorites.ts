'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { favoriteRefSchema } from '@/modules/library'
import { setFavorite } from '@/modules/library/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { getLibraryViewers, isVisibleContent } from '../_lib/library'

/**
 * Отложить и убрать из отложенного.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНО ДЕЙСТВИЕ НА ВСЕ ВИДЫ СОДЕРЖИМОГО
 *
 * Живёт в слое приложения, а не внутри разборов, курса или эфиров:
 * кнопка одна и та же на всех трёх страницах. Три одинаковых действия
 * в трёх модулях разошлись бы при первой же правке — тот же довод,
 * что у отметки о просмотре.
 *
 * Прав здесь не проверяем, и это не упущение: избранное всегда своё.
 * Идентификатор человека берётся из сессии, а не из запроса, — отложить
 * что-то другому человеку невозможно.
 *
 * А вот **видимость проверяем обязательно**. Без этого кнопка
 * превращается в способ узнать, что готовится к публикации: прислав
 * наугад идентификатор чужого черновика и получив «отложено», человек
 * узнаёт о его существовании. Поэтому сначала спрашиваем у раздела,
 * видно ли ему это вообще, и только потом пишем.
 * ─────────────────────────────────────────────────────────────────
 */
export const toggleFavoriteAction = defineAction({
  name: 'library.favorite.toggle',
  input: favoriteRefSchema.extend({
    /** Какое состояние должно получиться: `true` — отложено */
    favorite: z.boolean(),
  }),
  handler: async ({ entityType, entityId, favorite }) => {
    const viewers = await getLibraryViewers()
    if (!viewers) throw errors.unauthorized()

    const ref = { entityType, entityId }

    // Проверяем только при добавлении. Убрать из своего списка можно
    // что угодно, включая ссылку на разбор, который вчера сняли
    // с публикации: иначе строка останется в базе навсегда
    if (favorite && !(await isVisibleContent(viewers, ref))) {
      throw errors.notFound('Этого больше нет на платформе')
    }

    const result = await setFavorite(viewers.song.userId, ref, favorite)

    // Страница отложенного — единственное место, где список виден
    // целиком. Страницу, с которой нажали, обновляет сама кнопка:
    // перерисовывать разбор под работающим плеером нельзя
    revalidatePath(routes.app.me.favorites())

    return result
  },
})
