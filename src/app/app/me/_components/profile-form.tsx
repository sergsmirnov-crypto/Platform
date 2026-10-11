'use client'

import { useState, useTransition } from 'react'

// Именно из `profile`, а не из публичного входа модуля: тот тянет за собой
// серверный код, и сборка браузерной части падает
import { saveProfile } from '@/modules/identity/actions'
import {
  GENRES,
  MAX_FAVORITE_ARTISTS,
  SKILL_LEVELS,
  SOCIAL_NETWORKS,
} from '@/modules/identity/profile'
import type { UserProfile } from '@/modules/identity/profile'
import { Button, ChipsInput, Field, Input, Textarea, ToggleGroup } from '@/ui'

/**
 * Форма профиля.
 *
 * Собственный профиль показывается сразу в виде формы, без отдельного
 * режима просмотра и кнопки «Редактировать». Своя карточка открывается
 * ровно затем, чтобы что-то поправить; лишний шаг здесь только мешает.
 * Отдельная страница «как меня видят другие» появится на Этапе 8 вместе
 * с публичными профилями.
 *
 * Ошибки приходят с сервера разложенными по полям — форма подсвечивает
 * именно то поле, где проблема, а не показывает общее «проверьте данные».
 */

type ProfileFormProps = {
  profile: UserProfile
}

const CURRENT_YEAR = new Date().getFullYear()

export function ProfileForm({ profile }: ProfileFormProps) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [city, setCity] = useState(profile.city ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [playingSince, setPlayingSince] = useState(
    profile.playingSince === null ? '' : String(profile.playingSince),
  )
  const [skillLevel, setSkillLevel] = useState<string>(profile.skillLevel ?? '')
  const [artists, setArtists] = useState<string[]>(profile.favoriteArtists)
  const [genres, setGenres] = useState<string[]>(profile.favoriteGenres)
  const [socials, setSocials] = useState<Record<string, string>>(profile.socials)

  function handleSubmit() {
    setErrors({})
    setSavedAt(null)

    startTransition(async () => {
      const result = await saveProfile({
        displayName,
        city,
        bio,
        playingSince: playingSince === '' ? null : Number.parseInt(playingSince, 10),
        skillLevel: skillLevel === '' ? null : skillLevel,
        favoriteArtists: artists,
        favoriteGenres: genres,
        socials,
      })

      if (!result.ok) {
        setErrors(result.fields ?? {})
        if (!result.fields) setErrors({ form: result.message })
        return
      }

      setSavedAt(Date.now())
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
      className="max-w-2xl"
    >
      <Field
        label="Имя"
        htmlFor="displayName"
        error={errors.displayName}
        hint="Как вас называть в клубе"
      >
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={pending}
          aria-invalid={Boolean(errors.displayName)}
        />
      </Field>

      <Field label="Город" htmlFor="city" error={errors.city}>
        <Input
          id="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Например, Казань"
          disabled={pending}
        />
      </Field>

      <Field
        label="Год начала игры"
        htmlFor="playingSince"
        error={errors.playingSince}
        hint="Нужен, чтобы подбирать материалы по опыту"
      >
        <Input
          id="playingSince"
          type="number"
          inputMode="numeric"
          min={1930}
          max={CURRENT_YEAR}
          value={playingSince}
          onChange={(event) => setPlayingSince(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Уровень" htmlFor="skillLevel" error={errors.skillLevel}>
        <div className="flex flex-wrap gap-2">
          {SKILL_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              aria-pressed={skillLevel === level.value}
              disabled={pending}
              onClick={() => setSkillLevel(skillLevel === level.value ? '' : level.value)}
              className={`min-h-11 rounded-full border px-4 text-sm ${
                skillLevel === level.value
                  ? 'border-accent bg-accent text-accent-content'
                  : 'border-border text-content-muted hover:border-border-strong'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Любимые исполнители"
        htmlFor="artists"
        error={errors.favoriteArtists}
        hint={`Enter или запятая — добавить. До ${MAX_FAVORITE_ARTISTS}`}
      >
        <ChipsInput
          id="artists"
          values={artists}
          onChange={setArtists}
          max={MAX_FAVORITE_ARTISTS}
          placeholder="Metallica, Кино…"
          disabled={pending}
        />
      </Field>

      <Field label="Жанры" htmlFor="genres" error={errors.favoriteGenres}>
        <ToggleGroup options={GENRES} values={genres} onChange={setGenres} disabled={pending} />
      </Field>

      <Field
        label="О себе"
        htmlFor="bio"
        error={errors.bio}
        hint="Пара строк для карточки участника"
      >
        <Textarea
          id="bio"
          value={bio}
          maxLength={500}
          onChange={(event) => setBio(event.target.value)}
          disabled={pending}
        />
      </Field>

      <fieldset className="mt-6 mb-2">
        <legend className="text-content mb-3 text-sm font-medium">Ссылки</legend>

        {SOCIAL_NETWORKS.map((network) => (
          <Field
            key={network.key}
            label={network.label}
            htmlFor={network.key}
            error={errors[`socials.${network.key}`]}
          >
            <Input
              id={network.key}
              type="url"
              value={socials[network.key] ?? ''}
              placeholder={network.placeholder}
              onChange={(event) => setSocials({ ...socials, [network.key]: event.target.value })}
              disabled={pending}
            />
          </Field>
        ))}
      </fieldset>

      {errors.form ? <p className="text-danger mb-3 text-sm">{errors.form}</p> : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>

        {savedAt ? <span className="text-content-muted text-sm">Сохранено</span> : null}
      </div>
    </form>
  )
}
