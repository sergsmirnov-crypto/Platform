'use client'

import { searchCuratorCandidatesAction } from '../_actions/curator-editor'

import { AddCurator } from './add-curator'

/**
 * Обёртка над поиском участников.
 *
 * Нужна ровно затем, чтобы действие сервера не приходилось передавать
 * с серверной страницы в браузерный компонент через свойства: так форма
 * остаётся про разметку, а знание о том, какое действие вызывать,
 * лежит в одном месте.
 */
export function AddCuratorPanel() {
  return (
    <AddCurator
      search={async (query) => {
        const result = await searchCuratorCandidatesAction({ query })

        return result.ok ? result.data.candidates : []
      }}
    />
  )
}
