import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import type { DiaryEntry, ListDiaryEntriesResponse } from "@/services/api/diary";

const URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type DiaryCacheState = {
	entries: DiaryEntry[];
	isDirty: boolean;
	loadedAt: number | null;
	nextCursor: string | null;
};

type DiaryCacheByBabyId = Record<string, DiaryCacheState>;

type DiaryCacheContextValue = {
	appendDiaryPage: (babyId: string, response: ListDiaryEntriesResponse) => void;
	getDiaryCache: (babyId: string) => DiaryCacheState;
	markDiaryCacheDirty: (babyId: string) => void;
	removeDiaryEntryFromCache: (babyId: string, diaryId: string) => void;
	replaceDiaryEntryInCache: (babyId: string, entry: DiaryEntry) => void;
	setDiaryFirstPage: (babyId: string, response: ListDiaryEntriesResponse) => void;
	shouldRefreshDiaryCache: (babyId: string) => boolean;
};

const emptyCache: DiaryCacheState = {
	entries: [],
	isDirty: false,
	loadedAt: null,
	nextCursor: null,
};

const DiaryCacheContext = createContext<DiaryCacheContextValue | null>(null);

export function DiaryCacheProvider({ children }: { children: ReactNode }) {
	const [cacheByBabyId, setCacheByBabyId] = useState<DiaryCacheByBabyId>({});

	const getDiaryCache = useCallback(
		(babyId: string) => cacheByBabyId[babyId] ?? emptyCache,
		[cacheByBabyId],
	);

	const setDiaryFirstPage = useCallback(
		(babyId: string, response: ListDiaryEntriesResponse) => {
			setCacheByBabyId((currentCache) => ({
				...currentCache,
				[babyId]: {
					entries: response.diaryEntries,
					isDirty: false,
					loadedAt: Date.now(),
					nextCursor: response.nextCursor,
				},
			}));
		},
		[],
	);

	const appendDiaryPage = useCallback(
		(babyId: string, response: ListDiaryEntriesResponse) => {
			setCacheByBabyId((currentCache) => {
				const currentBabyCache = currentCache[babyId] ?? emptyCache;

				return {
					...currentCache,
					[babyId]: {
						...currentBabyCache,
						entries: mergeEntries(currentBabyCache.entries, response.diaryEntries),
						nextCursor: response.nextCursor,
					},
				};
			});
		},
		[],
	);

	const replaceDiaryEntryInCache = useCallback((babyId: string, entry: DiaryEntry) => {
		setCacheByBabyId((currentCache) => {
			const currentBabyCache = currentCache[babyId] ?? emptyCache;
			const filteredEntries = currentBabyCache.entries.filter(
				(currentEntry) => currentEntry.id !== entry.id,
			);

			return {
				...currentCache,
				[babyId]: {
					...currentBabyCache,
					entries: [entry, ...filteredEntries].sort(compareDiaryEntries),
					isDirty: false,
					loadedAt: currentBabyCache.loadedAt ?? Date.now(),
				},
			};
		});
	}, []);

	const removeDiaryEntryFromCache = useCallback((babyId: string, diaryId: string) => {
		setCacheByBabyId((currentCache) => {
			const currentBabyCache = currentCache[babyId] ?? emptyCache;

			return {
				...currentCache,
				[babyId]: {
					...currentBabyCache,
					entries: currentBabyCache.entries.filter((entry) => entry.id !== diaryId),
				},
			};
		});
	}, []);

	const markDiaryCacheDirty = useCallback((babyId: string) => {
		setCacheByBabyId((currentCache) => {
			const currentBabyCache = currentCache[babyId] ?? emptyCache;

			return {
				...currentCache,
				[babyId]: {
					...currentBabyCache,
					isDirty: true,
				},
			};
		});
	}, []);

	const shouldRefreshDiaryCache = useCallback(
		(babyId: string) => {
			const cache = cacheByBabyId[babyId];

			if (!cache?.loadedAt || cache.isDirty || cache.entries.length === 0) {
				return true;
			}

			const earliestExpiry = getEarliestMediaUrlExpiry(cache.entries);

			return earliestExpiry !== null && Date.now() + URL_REFRESH_BUFFER_MS >= earliestExpiry;
		},
		[cacheByBabyId],
	);

	const value = useMemo(
		() => ({
			appendDiaryPage,
			getDiaryCache,
			markDiaryCacheDirty,
			removeDiaryEntryFromCache,
			replaceDiaryEntryInCache,
			setDiaryFirstPage,
			shouldRefreshDiaryCache,
		}),
		[
			appendDiaryPage,
			getDiaryCache,
			markDiaryCacheDirty,
			removeDiaryEntryFromCache,
			replaceDiaryEntryInCache,
			setDiaryFirstPage,
			shouldRefreshDiaryCache,
		],
	);

	return (
		<DiaryCacheContext.Provider value={value}>{children}</DiaryCacheContext.Provider>
	);
}

export function useDiaryCache() {
	const context = useContext(DiaryCacheContext);

	if (!context) {
		throw new Error("useDiaryCache must be used within DiaryCacheProvider.");
	}

	return context;
}

function mergeEntries(currentEntries: DiaryEntry[], nextEntries: DiaryEntry[]) {
	const entriesById = new Map(currentEntries.map((entry) => [entry.id, entry]));

	for (const entry of nextEntries) {
		entriesById.set(entry.id, entry);
	}

	return Array.from(entriesById.values()).sort(compareDiaryEntries);
}

function compareDiaryEntries(left: DiaryEntry, right: DiaryEntry) {
	const diaryDateCompare = right.diaryDate.localeCompare(left.diaryDate);

	if (diaryDateCompare !== 0) {
		return diaryDateCompare;
	}

	const createdAtCompare =
		new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

	if (createdAtCompare !== 0) {
		return createdAtCompare;
	}

	return right.id.localeCompare(left.id);
}

function getEarliestMediaUrlExpiry(entries: DiaryEntry[]) {
	const expiries = entries.flatMap((entry) =>
		entry.media
			.flatMap((media) => [media.mediaUrlExpiresAt, media.thumbnailUrlExpiresAt])
			.map((value) => (value ? new Date(value).getTime() : null))
			.filter((value): value is number => value !== null && !Number.isNaN(value)),
	);

	if (expiries.length === 0) {
		return null;
	}

	return Math.min(...expiries);
}
