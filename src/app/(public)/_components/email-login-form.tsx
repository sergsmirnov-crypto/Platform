'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { identityStrings } from '@/modules/identity/strings'
import { appConfig } from '@/shared/config/app.config'
import { Button, Field, Input } from '@/ui'

import { requestLoginCodeAction, verifyLoginCodeAction } from '../_actions/auth'

/**
 * Вход по почте: адрес → код из письма → внутрь.
 *
 * Оба шага на одном экране, без перехода на другую страницу: человек,
 * ошибившийся в адресе, возвращается одним нажатием, а не кнопкой
 * «Назад» браузера, которая на телефоне уводит неизвестно куда.
 *
 * Код отправляется сам, как только набраны все цифры: на телефоне
 * клавиатура закрывает кнопку «Войти», и искать её незачем.
 */

const strings = identityStrings.emailLogin
const CODE_LENGTH = appConfig.auth.codeLength

type Errors = Record<string, string>

/** Текст ошибки для человека: письмо не ушло — отдельный, понятный случай */
function failureMessage(result: { code: string; message: string }): string {
  return result.code === 'upstream_unavailable' ? strings.errors.sendFailed : result.message
}

export function EmailLoginForm({ returnTo }: { returnTo: string | null }) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [pending, startTransition] = useTransition()

  // Обратный отсчёт до повторной отправки
  useEffect(() => {
    if (resendIn <= 0) return

    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  function sendCode(isResend: boolean) {
    setErrors({})
    setNotice(null)

    startTransition(async () => {
      const result = await requestLoginCodeAction({ email })

      if (!result.ok) {
        setErrors(result.fields ?? { form: failureMessage(result) })
        return
      }

      setMaskedEmail(result.data.maskedEmail)
      setResendIn(result.data.resendAfterSeconds)
      setCode('')
      setStep('code')
      if (isResend) setNotice(strings.resent)
    })
  }

  function verify(value: string) {
    setErrors({})
    setNotice(null)

    startTransition(async () => {
      const result = await verifyLoginCodeAction({ email, code: value, returnTo })

      if (!result.ok) {
        setErrors(result.fields ?? { form: failureMessage(result) })
        return
      }

      router.replace(result.data.destination)
    })
  }

  function handleCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)

    if (digits.length === CODE_LENGTH && !pending) verify(digits)
  }

  if (step === 'email') {
    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          sendCode(false)
        }}
      >
        <Field label={strings.emailLabel} htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={strings.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            required
          />
        </Field>

        {errors.form ? <p className="text-danger mb-4 text-sm">{errors.form}</p> : null}

        <Button type="submit" fullWidth disabled={pending || !email.trim()}>
          {pending ? strings.requesting : strings.requestCode}
        </Button>
      </form>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        verify(code)
      }}
    >
      <h2 className="text-lg font-semibold">{strings.codeTitle}</h2>
      <p className="text-content-muted mt-1 mb-5 text-sm">
        {strings.codeSentTo(maskedEmail)} {strings.codeHint}
      </p>

      <Field label={strings.codeLabel} htmlFor="code" error={errors.code}>
        <Input
          id="code"
          // Поле появляется в ответ на действие человека, поэтому
          // переводить на него фокус уместно: не надо тянуться пальцем
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH + 2}
          className="text-center text-2xl tracking-[0.4em]"
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          aria-invalid={Boolean(errors.code)}
          disabled={pending}
        />
      </Field>

      {errors.form ? <p className="text-danger mb-4 text-sm">{errors.form}</p> : null}
      {notice ? <p className="text-content-muted mb-4 text-sm">{notice}</p> : null}

      <Button type="submit" fullWidth disabled={pending || code.length !== CODE_LENGTH}>
        {pending ? strings.verifying : strings.verify}
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep('email')
            setErrors({})
            setNotice(null)
          }}
        >
          {strings.changeEmail}
        </Button>

        {resendIn > 0 ? (
          <span className="text-content-subtle">{strings.resendIn(resendIn)}</span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => sendCode(true)}
          >
            {strings.resend}
          </Button>
        )}
      </div>
    </form>
  )
}
