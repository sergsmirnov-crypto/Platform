/**
 * Разметка публичной зоны: лендинг, вход, юридические страницы.
 * Сессия здесь не требуется.
 *
 * Шапку и подвал добавит шаг F5 (дизайн-система).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>
}
