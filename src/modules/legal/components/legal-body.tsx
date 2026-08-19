import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Текст правового документа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ MARKDOWN, А НЕ МАССИВ БЛОКОВ
 *
 * В проекте есть свой набор блоков для уроков, и соблазн переиспользовать
 * его тут велик. Но правовой текст правит юрист и возвращает его файлом
 * с правками. Вставить их в Markdown — минута; переложить в массив
 * типизированных блоков — час, в течение которого легко потерять пункт
 * договора. Документ, который дорого править, через год отстанет
 * от действительности, а расхождение между офертой и реальностью —
 * это уже не вопрос удобства.
 *
 * Плата за решение — две зависимости. Она невелика: страницы серверные,
 * разметка собирается на сервере, в браузер библиотека не уезжает.
 *
 * Оформление задано перечислением элементов, а не плагином типографики:
 * набор элементов в наших документах закрыт (заголовки, абзацы, списки,
 * таблицы, выделение, ссылки), и держать зависимость ради него незачем.
 * ─────────────────────────────────────────────────────────────────
 */
export function LegalBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-[0.9375rem] leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 text-lg font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-content mt-6 mb-2 text-base font-medium">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 marker:opacity-40">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 marker:opacity-40">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="underline decoration-1 underline-offset-2">
              {children}
            </a>
          ),
          // Таблицы в документах — это перечни реквизитов и сроков.
          // На узком экране они переносятся, а не уезжают за край:
          // договор читают с телефона так же часто, как с ноутбука
          table: ({ children }) => (
            <div className="border-border mb-4 overflow-x-auto rounded border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-sunken">{children}</thead>,
          tr: ({ children }) => (
            <tr className="border-border border-b last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left align-top font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="border-border my-8" />,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
