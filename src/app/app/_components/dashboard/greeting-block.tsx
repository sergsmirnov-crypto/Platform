import { currentClubHour, greetingFor } from '../../_lib/greeting'

/**
 * Приветствие на главной.
 *
 * Обращение по имени — не украшение: платформа закрытая, и человек
 * должен с первой секунды видеть, что он здесь свой, а не на витрине.
 */
export function GreetingBlock({ displayName }: { displayName: string }) {
  const firstName = displayName.trim().split(' ')[0] || displayName

  return (
    <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
      {greetingFor(currentClubHour())}, {firstName}
    </h1>
  )
}
