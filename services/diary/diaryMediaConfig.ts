export const DIARY_MEDIA_LIMITS = {
	MAX_PHOTOS: 10,
	MAX_VIDEOS: 3,
	MAX_PHOTO_SIZE_BYTES: 8 * 1024 * 1024,
	MAX_VIDEO_SIZE_BYTES: 30 * 1024 * 1024,
	MAX_TOTAL_SIZE_BYTES: 100 * 1024 * 1024,
	MAX_VIDEO_DURATION_SECONDS: 30,
} as const;

export const DIARY_MEDIA_CONTENT_TYPES = {
	PHOTO: ["image/jpeg", "image/png", "image/webp"],
	VIDEO: ["video/mp4", "video/quicktime"],
} as const;

export type DiaryPhotoContentType = (typeof DIARY_MEDIA_CONTENT_TYPES.PHOTO)[number];
export type DiaryVideoContentType = (typeof DIARY_MEDIA_CONTENT_TYPES.VIDEO)[number];
export type DiaryMediaContentType = DiaryPhotoContentType | DiaryVideoContentType;

export function isDiaryPhotoContentType(value: string): value is DiaryPhotoContentType {
	return (DIARY_MEDIA_CONTENT_TYPES.PHOTO as readonly string[]).includes(value);
}

export function isDiaryVideoContentType(value: string): value is DiaryVideoContentType {
	return (DIARY_MEDIA_CONTENT_TYPES.VIDEO as readonly string[]).includes(value);
}
