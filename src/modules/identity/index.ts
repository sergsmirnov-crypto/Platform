/**
 * Публичный вход в модуль «Личность».
 *
 * Модуль отвечает на вопрос «кто передо мной». На вопрос «что ему можно»
 * отвечает модуль `access`, на вопрос «оплачено ли» — `subscription`.
 *
 * ⚠️ Здесь перечислено только то, что работает В ЛЮБОМ окружении: и на сайте,
 * и в процессе фоновых задач. Всё, что связано с текущим запросом — cookie,
 * серверные действия, чтение заголовков, — сюда НЕ попадает: оно требует
 * контекста запроса и тянет за собой код Next.js, из-за чего процесс
 * фоновых задач не смог бы запуститься.
 *
 * Такие вещи импортируются явным путём, как это уже сделано с `env.server`
 * и клиентом Telegram:
 *
 *     import { getSession } from '@/modules/identity/current-user'
 *     import { signOutAndRedirect } from '@/modules/identity/actions'
 */
export {
  cleanupSessions,
  endAllSessions,
  endDevice,
  endSession,
  listDevices,
  startSession,
} from './service'
export {
  findAllUsersForDevelopment,
  findProfile,
  findTelegramIdByUserId,
  findTelegramUsername,
  findUserById,
  findUserByTelegramId,
  findProfileVisibility,
  updateProfileVisibility,
} from './repository'
export {
  AVATAR_SIZES,
  AVATAR_SOURCE_SIZE,
  avatarObjectKey,
  avatarObjectKeys,
  avatarUploadSchema,
} from './avatar'
export type { AvatarSize, AvatarUploadInput } from './avatar'
export {
  GENRES,
  MAX_FAVORITE_ARTISTS,
  SKILL_LEVELS,
  SOCIAL_NETWORKS,
  normalizeArtists,
  profileInputSchema,
  yearsPlayingLabel,
} from './profile'
export type { Genre, ProfileInput, SocialKey, UserProfile } from './profile'
export {
  goalLabel,
  goalsStepSchema,
  isFinalStep,
  isOnboardingDone,
  levelStepSchema,
  nameStepSchema,
  ONBOARDING_GOALS,
  ONBOARDING_QUESTION_COUNT,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  questionNumber,
  resolveStepIndex,
  stepIndexFromParam,
  stepKeyAt,
  stepParamFromIndex,
  tasteStepSchema,
} from './onboarding'
export type {
  GoalsStepInput,
  LevelStepInput,
  NameStepInput,
  OnboardingGoal,
  OnboardingStepKey,
  TasteStepInput,
} from './onboarding'
export {
  buildMemberQuery,
  DEFAULT_MEMBER_FILTERS,
  hasActiveMemberFilters,
  MEMBER_ACCESS_FILTERS,
  MEMBER_SORTS,
  parseMemberFilters,
} from './directory-filters'
export type { MemberAccessFilter, MemberFilters, MemberSort } from './directory-filters'
export { directoryStrings } from './directory-strings'
export {
  blockReasonLabel,
  blockReasonSchema,
  MAX_BLOCK_REASON_LENGTH,
  MIN_BLOCK_REASON_LENGTH,
} from './moderation'
export { avatarUrlFor } from './avatar-url'
export { describeDevice, lastSeenLabel } from './devices'
export type { DeviceDescription, DeviceKind } from './devices'
export { deleteOwnAccount } from './account'
export { signInWithTelegram } from './telegram-login'
export type { TelegramSignInResult } from './telegram-login'
export { isDevAuthAvailable } from './dev-auth'
export { safeReturnTo } from './return-to'
export { identityStrings } from './strings'
export { onboardingStrings } from './onboarding-strings'

export type { RequestOrigin, SessionContext, SessionDevice, SessionUser } from './types'
