/**
 * Публичный вход в дизайн-систему.
 *
 * Компоненты отсюда ничего не знают о бизнес-логике: данные приходят
 * через свойства. Это проверяется линтером — `ui/` не может импортировать
 * бизнес-модули.
 */
export { Button, buttonVariants } from './primitives/button'
export type { ButtonProps } from './primitives/button'
export { LinkButton } from './primitives/link-button'
export type { LinkButtonProps } from './primitives/link-button'
export { PillLink } from './primitives/pill-link'

export { Card, CardBody, CardTitle, CardMeta, CardActions } from './primitives/card'
export { Badge } from './primitives/badge'
export type { BadgeProps } from './primitives/badge'
export { Input, Textarea, Label, Field } from './primitives/input'
export { ChipsInput } from './primitives/chips-input'
export { FileDrop } from './primitives/file-drop'
export { ToggleGroup } from './primitives/toggle-group'
export { Avatar } from './primitives/avatar'
export { Dialog } from './primitives/dialog'
export { ImageCropper } from './primitives/image-cropper'
export { ProgressMarker } from './primitives/progress-marker'
export { Skeleton } from './primitives/skeleton'

export { Breadcrumbs } from './patterns/breadcrumbs'
export { EmptyState } from './patterns/empty-state'
export { PageHeader } from './patterns/page-header'
export { PropertyList } from './patterns/property-list'
export type { Property } from './patterns/property-list'
export { Highlight } from './patterns/highlight'
export { Wave } from './patterns/wave'
export { PagePlaceholder, StageNote } from './patterns/page-placeholder'
export { SongCover, coverColors, COVER_PALETTE } from './patterns/song-cover'

export { cn } from './lib/cn'
export { uploadFile } from './lib/upload-file'
export type { UploadFileOptions } from './lib/upload-file'
