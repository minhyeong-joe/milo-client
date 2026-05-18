export const BABY_NAME_MAX_LENGTH = 20;
export const TAG_NAME_MAX_LENGTH = 30;
export const DIARY_TAG_MAX_COUNT = 10;
export const BABY_AVATAR_MAX_SIZE_BYTES = 1 * 1024 * 1024;

export const BABY_AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;

export type BabyAvatarContentType = (typeof BABY_AVATAR_CONTENT_TYPES)[number];

export function isBabyAvatarContentType(value: unknown): value is BabyAvatarContentType {
	return (BABY_AVATAR_CONTENT_TYPES as readonly unknown[]).includes(value);
}

export function formatValidationMegabytes(value: number) {
	return `${Math.round(value / (1024 * 1024))} MB`;
}
