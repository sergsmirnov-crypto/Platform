'use client'

/**
 * Запасной экран на случай, если сломалась сама разметка приложения.
 *
 * Здесь нельзя пользоваться дизайн-системой и общими стилями: до них
 * дело могло не дойти. Поэтому всё оформление — прямо в разметке,
 * а страница включает собственные теги html и body.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: '#0f0f12',
          color: '#f4f4f2',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Платформа не отвечает</h1>
          <p style={{ marginTop: 12, lineHeight: 1.6, color: '#9a9aa3' }}>
            Мы уже знаем о сбое. Попробуйте обновить страницу через пару минут.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: '0 24px',
              borderRadius: 999,
              border: 0,
              background: '#ffdd2d',
              color: '#16161a',
              font: 'inherit',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
          {error.digest ? (
            <p style={{ marginTop: 32, fontSize: 14, color: '#6d6d76' }}>
              Код происшествия: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
