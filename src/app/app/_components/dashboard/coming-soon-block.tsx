import { BookOpen, GraduationCap, Radio } from 'lucide-react'

/**
 * Что появится на платформе.
 *
 * Временный блок на период, пока содержимое переносится из Telegram.
 * Снимается на Этапе 7, когда разборы, курс и эфиры станут настоящими.
 *
 * Нужен по одной причине: пустой первый экран участник читает как
 * «платформа не работает». Честное «вот что здесь будет и когда»
 * читается как «идёт работа» — и это правда.
 */

const ITEMS = [
  {
    icon: BookOpen,
    title: 'Разборы песен',
    text: 'Библиотека с уровнями сложности, табами и разбором по частям',
  },
  {
    icon: GraduationCap,
    title: 'Курс',
    text: 'Модули и уроки с сохранением места, на котором вы остановились',
  },
  {
    icon: Radio,
    title: 'Записи эфиров',
    text: 'Архив с оглавлением: нужный кусок находится без перемотки',
  },
]

export function ComingSoonBlock() {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">Платформа наполняется</h2>
      <p className="text-content-muted mb-4 text-sm">
        Материалы клуба переезжают из Telegram. Разделы открываются по мере готовности.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.title} className="border-border rounded-xl border border-dashed p-4">
            <item.icon size={20} aria-hidden className="text-content-subtle" />
            <p className="mt-2 font-medium">{item.title}</p>
            <p className="text-content-muted mt-1 text-sm">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
