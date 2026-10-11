'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { clubStrings } from '@/modules/club'
import { setProfileVisibility } from '@/modules/identity/actions'
import { routes } from '@/shared/routes'
import { Badge, Button, Card, CardBody, CardTitle, PillLink } from '@/ui'

/**
 * Открыть или закрыть свою визитку.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕСТНОЕ ОПИСАНИЕ ПОСЛЕДСТВИЙ РЯДОМ С ПЕРЕКЛЮЧАТЕЛЕМ
 *
 * Согласие имеет смысл, только если человек понимает, на что
 * соглашается. Поэтому здесь не «Публичный профиль ✓», а перечисление:
 * что именно увидят участники и чего не увидят никогда.
 *
 * Отдельно сказано, что «открыто» значит «видно участникам клуба»,
 * а не «видно интернету»: без этого уточнения половина людей поймёт
 * переключатель как выход в открытый доступ и не станет его трогать.
 * ─────────────────────────────────────────────────────────────────
 */
export function VisibilityCard({ visibility }: { visibility: 'private' | 'club' }) {
  const strings = clubStrings.visibility
  const router = useRouter()

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isOpen = visibility === 'club'

  function toggle(): void {
    setError(null)

    startTransition(async () => {
      const result = await setProfileVisibility({ visibility: isOpen ? 'private' : 'club' })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CardTitle>{strings.title}</CardTitle>
          <Badge variant={isOpen ? 'outline' : 'draft'} size="sm">
            {isOpen ? 'Открыта' : 'Закрыта'}
          </Badge>
        </div>

        <p className="mb-2 font-medium">{isOpen ? strings.club : strings.private}</p>

        <p className="text-content-muted mb-2 text-sm">{strings.hint}</p>
        <p className="text-content-subtle mb-5 text-sm">{strings.notice}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant={isOpen ? 'secondary' : 'primary'} onClick={toggle} disabled={pending}>
            {isOpen ? strings.close : strings.open}
          </Button>

          {isOpen ? (
            <PillLink href={routes.app.club.members()} size="sm">
              {clubStrings.members.title}
            </PillLink>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
