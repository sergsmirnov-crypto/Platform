import { Eye } from 'lucide-react'

import { PreviewToggle } from './preview-toggle'

/**
 * Полоса вверху экрана в режиме «смотреть как участник».
 *
 * Обязательна и обязана быть заметной. Человек, забывший, что включил
 * режим, решит, что платформа сломалась: пропали кнопки, исчезли
 * черновики, из меню ушёл целый раздел. Полоса отвечает на этот вопрос
 * до того, как он возникнет.
 *
 * Прилипает к верху экрана и остаётся видимой при прокрутке — вместе
 * с шапкой, которая на её высоту сдвинута (см. разметку закрытой зоны).
 *
 * Жёлтый фон с чёрным текстом: белый на жёлтом даёт контраст 1,6:1
 * при требуемых 4,5:1 (docs/COMPONENTS.md).
 */
export function PreviewBanner() {
  return (
    <div className="bg-accent text-accent-content sticky top-0 z-40 h-10">
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-2 px-4 text-sm md:px-6">
        <Eye size={16} aria-hidden className="shrink-0" />

        <p className="truncate">
          <span className="font-medium">Глазами участника.</span>{' '}
          <span className="hidden sm:inline">Управление и черновики скрыты</span>
        </p>

        <PreviewToggle
          mode="exit"
          className="ml-auto shrink-0 rounded-full border border-current px-3 py-1 text-xs font-medium hover:bg-black/10"
        >
          Вернуться к управлению
        </PreviewToggle>
      </div>
    </div>
  )
}
