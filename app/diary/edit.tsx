import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
	DiaryEntryForm,
	type UploadedDiaryMedia,
} from "@/components/diary/DiaryEntryForm";
import { useTimelineTimeZone } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import { useSync } from "@/context/SyncContext";
import {
	removeDiaryMediaUpload,
	updateDiaryEntry,
	type DiaryEntry,
	type DiaryMediaInput,
	type DiaryTag,
} from "@/services/api/diary";
import { ApiError } from "@/services/api/httpClient";
import { createTag, listTags } from "@/services/api/tags";
import { loadCachedTags, saveTagsCache } from "@/services/tags/tagOfflineStore";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

export default function EditDiaryScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ entry?: string }>();
	const entry = parseEntryParam(params.entry);
	const { session } = useAuthSession();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const { replaceDiaryEntryInCache } = useDiaryCache();
	const { connectionStatus, markOffline, markOnline } = useSync();
	const [error, setError] = useState<string | null>(null);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [isLoadingTags, setIsLoadingTags] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [availableTags, setAvailableTags] = useState<DiaryTag[]>([]);

	const loadTags = useCallback(async () => {
		if (!selectedBaby) {
			setAvailableTags([]);
			return;
		}

		setIsLoadingTags(true);

		try {
			if (!session) {
				return;
			}

			const cachedTags = await loadCachedTags(session.user.id, selectedBaby.id);
			if (cachedTags.length > 0) {
				setAvailableTags(cachedTags);
			}

			if (connectionStatus !== "online") {
				return;
			}

			const response = await listTags({
				babyId: selectedBaby.id,
			});

			setAvailableTags(response.tags);
			await saveTagsCache(session.user.id, selectedBaby.id, response.tags);
			markOnline();
		} catch (caughtError) {
			console.warn(caughtError);
			markOffline();
		} finally {
			setIsLoadingTags(false);
		}
	}, [connectionStatus, markOffline, markOnline, selectedBaby, session]);

	useEffect(() => {
		if (connectionStatus === "online") {
			void loadTags();
		}
	}, [connectionStatus, loadTags]);

	const handleCreateTag = useCallback(async (name: string) => {
		if (!selectedBaby) {
			throw new Error("Choose a baby before creating tags.");
		}

		if (connectionStatus !== "online") {
			throw new Error(DIARY_OFFLINE_MESSAGE);
		}

		const trimmedName = name.trim();
		setIsCreatingTag(true);

		try {
			const response = await createTag(selectedBaby.id, {
				name: trimmedName,
				type: "custom",
			});
			setAvailableTags((currentTags) => mergeTags(currentTags, [response.tag]));
			void loadTags();
			return response.tag;
		} catch (caughtError) {
			if (caughtError instanceof ApiError && caughtError.code === "TAG_EXISTS") {
				const response = await listTags({ babyId: selectedBaby.id });
				setAvailableTags(response.tags);
				const matchingTag = response.tags.find(
					(tag) => normalizeTagName(tag.name) === normalizeTagName(trimmedName),
				);

				if (matchingTag) {
					return matchingTag;
				}
			}

			throw caughtError;
		} finally {
			setIsCreatingTag(false);
		}
	}, [connectionStatus, loadTags, selectedBaby]);

	const handleSubmit = async (input: {
		content: string;
		diaryDate: string;
		media: DiaryMediaInput[];
		tagIds: string[];
		title: string | null;
	}) => {
		if (!selectedBaby || !entry) {
			setError("Choose a baby before saving this diary entry.");
			return;
		}

		if (connectionStatus !== "online") {
			setError(DIARY_OFFLINE_MESSAGE);
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			const response = await updateDiaryEntry(selectedBaby.id, entry.id, {
				content: input.content,
				diaryDate: input.diaryDate,
				media: input.media,
				tagIds: input.tagIds,
				title: input.title,
			});
			await cleanupRemovedPersistedMedia(selectedBaby.id, entry.media, input.media);
			replaceDiaryEntryInCache(selectedBaby.id, response.diaryEntry);
			markOnline();
			router.back();
		} catch (caughtError) {
			markOffline();
			setError(getErrorMessage(caughtError));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={styles.header}>
				<Pressable
					accessibilityLabel="Go back"
					hitSlop={10}
					onPress={() => router.back()}
					style={styles.iconButton}
				>
					<Ionicons color={colors.light.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Text style={styles.headerTitle}>Edit Diary</Text>
				<View style={styles.iconButton} />
			</View>

			{connectionStatus !== "online" ? (
				<DiaryRouteOfflineState
					message={DIARY_OFFLINE_MESSAGE}
					onBack={() => router.back()}
				/>
			) : selectedBaby && entry ? (
				<DiaryEntryForm
					availableTags={availableTags}
					babyId={selectedBaby.id}
					error={error}
					initialContent={entry.content}
					initialDate={dateFromKey(entry.diaryDate)}
					initialMedia={entry.media.map(toUploadedDiaryMedia)}
					initialSelectedTags={entry.tags}
					initialTitle={entry.title}
					isCreatingTag={isCreatingTag}
					isLoadingTags={isLoadingTags}
					isOnline={connectionStatus === "online"}
					isSaving={isSaving}
					onCancel={() => router.back()}
					onCreateTag={handleCreateTag}
					onSubmit={handleSubmit}
					submitLabel="Save Changes"
					timeZone={timelineTimeZone}
				/>
			) : (
				<View style={globalStyles.screenContent}>
					<View style={globalStyles.card}>
						<Text style={globalStyles.sectionTitleText}>Entry not loaded</Text>
						<Text style={globalStyles.bodyText}>
							Go back to Diary and open this entry again.
						</Text>
					</View>
				</View>
			)}
		</SafeAreaView>
	);
}

function parseEntryParam(value: string | undefined) {
	if (!value) {
		return null;
	}

	try {
		return JSON.parse(decodeURIComponent(value)) as DiaryEntry;
	} catch (error) {
		console.warn(error);
		return null;
	}
}

function toUploadedDiaryMedia(media: DiaryEntry["media"][number]): UploadedDiaryMedia {
	return {
		description: media.description,
		fileType: media.fileType,
		localUri: "",
		mediaUrl: media.mediaUrl,
		objectKey: media.objectKey,
		sizeBytes: media.sizeBytes,
		sortOrder: media.sortOrder,
		thumbnailFileType: media.thumbnailFileType,
		thumbnailLocalUri: null,
		thumbnailObjectKey: media.thumbnailObjectKey,
		thumbnailSizeBytes: media.thumbnailSizeBytes,
		thumbnailUrl: media.thumbnailUrl,
	};
}

async function cleanupRemovedPersistedMedia(
	babyId: string,
	initialMedia: DiaryEntry["media"],
	nextMedia: DiaryMediaInput[],
) {
	const keptKeys = new Set(
		nextMedia.flatMap((item) => [item.objectKey, item.thumbnailObjectKey].filter(isString)),
	);
	const removedKeys = initialMedia
		.flatMap((item) => [item.objectKey, item.thumbnailObjectKey].filter(isString))
		.filter((objectKey) => !keptKeys.has(objectKey));

	await Promise.all(
		removedKeys.map(async (objectKey) => {
			try {
				await removeDiaryMediaUpload(babyId, { objectKey });
			} catch (error) {
				console.warn("Could not cleanup removed diary media.", error);
			}
		}),
	);
}

function isString(value: string | null | undefined): value is string {
	return typeof value === "string" && value.length > 0;
}

function dateFromKey(dateKey: string) {
	const [year, month, day] = dateKey.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function mergeTags(currentTags: DiaryTag[], nextTags: DiaryTag[]) {
	const tagById = new Map(currentTags.map((tag) => [tag.id, tag]));

	for (const tag of nextTags) {
		tagById.set(tag.id, tag);
	}

	return Array.from(tagById.values());
}

function normalizeTagName(value: string) {
	return value.trim().toLocaleLowerCase();
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save this diary entry.";
}

const DIARY_OFFLINE_MESSAGE =
	"Reconnect to edit diary entries.";

function DiaryRouteOfflineState({
	message,
	onBack,
}: {
	message: string;
	onBack: () => void;
}) {
	return (
		<View style={globalStyles.screenContent}>
			<View style={[globalStyles.card, styles.offlineCard]}>
				<Ionicons color={colors.light.textSecondary} name="cloud-offline-outline" size={32} />
				<Text style={styles.offlineTitle}>Diary unavailable offline</Text>
				<Text style={styles.offlineText}>{message}</Text>
				<Pressable accessibilityRole="button" onPress={onBack} style={styles.offlineButton}>
					<Text style={styles.offlineButtonText}>Back</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	headerTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	iconButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	offlineButton: {
		backgroundColor: colors.light.primary,
		borderRadius: 999,
		marginTop: spacing.sm,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	offlineButtonText: {
		...typography.caption,
		color: colors.light.surface,
		fontWeight: "700",
	},
	offlineCard: {
		alignItems: "center",
		gap: spacing.sm,
		marginTop: spacing.lg,
	},
	offlineText: {
		...typography.body,
		color: colors.light.textSecondary,
		textAlign: "center",
	},
	offlineTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
		textAlign: "center",
	},
});
