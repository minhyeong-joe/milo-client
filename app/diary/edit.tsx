import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
	DiaryEntryForm,
	type UploadedDiaryMedia,
} from "@/components/diary/DiaryEntryForm";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import {
	removeDiaryMediaUpload,
	updateDiaryEntry,
	type DiaryEntry,
	type DiaryMediaInput,
	type DiaryTag,
} from "@/services/api/diary";
import { ApiError } from "@/services/api/httpClient";
import { createTag, listTags } from "@/services/api/tags";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

export default function EditDiaryScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ entry?: string }>();
	const entry = parseEntryParam(params.entry);
	const { selectedBaby } = useBabySelection();
	const { replaceDiaryEntryInCache } = useDiaryCache();
	const [error, setError] = useState<string | null>(null);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isSearchingTags, setIsSearchingTags] = useState(false);
	const [tagSuggestions, setTagSuggestions] = useState<DiaryTag[]>([]);
	const tagSearchRequestId = useRef(0);

	const handleSearchTags = useCallback(async (search: string) => {
		if (!selectedBaby) {
			setTagSuggestions([]);
			return;
		}

		const trimmedSearch = search.trim();
		const requestId = tagSearchRequestId.current + 1;
		tagSearchRequestId.current = requestId;

		if (trimmedSearch.length < 3) {
			setTagSuggestions([]);
			setIsSearchingTags(false);
			return;
		}

		setIsSearchingTags(true);

		try {
			const response = await listTags({
				babyId: selectedBaby.id,
				search: trimmedSearch,
			});

			if (tagSearchRequestId.current === requestId) {
				setTagSuggestions(response.tags);
			}
		} catch (caughtError) {
			console.warn(caughtError);
			if (tagSearchRequestId.current === requestId) {
				setTagSuggestions([]);
			}
		} finally {
			if (tagSearchRequestId.current === requestId) {
				setIsSearchingTags(false);
			}
		}
	}, [selectedBaby]);

	const handleCreateTag = useCallback(async (name: string) => {
		if (!selectedBaby) {
			throw new Error("Choose a baby before creating tags.");
		}

		const trimmedName = name.trim();
		setIsCreatingTag(true);

		try {
			const response = await createTag(selectedBaby.id, {
				name: trimmedName,
				type: "custom",
			});
			setTagSuggestions((currentTags) => mergeTags(currentTags, [response.tag]));
			return response.tag;
		} catch (caughtError) {
			if (caughtError instanceof ApiError && caughtError.code === "TAG_EXISTS") {
				const response = await listTags({
					babyId: selectedBaby.id,
					search: trimmedName,
				});
				const matchingTag = response.tags.find(
					(tag) => normalizeTagName(tag.name) === normalizeTagName(trimmedName),
				);

				if (matchingTag) {
					setTagSuggestions((currentTags) => mergeTags(currentTags, response.tags));
					return matchingTag;
				}
			}

			throw caughtError;
		} finally {
			setIsCreatingTag(false);
		}
	}, [selectedBaby]);

	const handleSubmit = async (input: {
		content: string;
		diaryDate: string;
		media: DiaryMediaInput[];
		tagIds: string[];
	}) => {
		if (!selectedBaby || !entry) {
			setError("Choose a baby before saving this diary entry.");
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
			});
			await cleanupRemovedPersistedMedia(selectedBaby.id, entry.media, input.media);
			replaceDiaryEntryInCache(selectedBaby.id, response.diaryEntry);
			router.replace({
				pathname: "/diary/[diaryId]",
				params: {
					diaryId: response.diaryEntry.id,
					entry: encodeURIComponent(JSON.stringify(response.diaryEntry)),
				},
			});
		} catch (caughtError) {
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

			{selectedBaby && entry ? (
				<DiaryEntryForm
					babyId={selectedBaby.id}
					error={error}
					initialContent={entry.content}
					initialDate={dateFromKey(entry.diaryDate)}
					initialMedia={entry.media.map(toUploadedDiaryMedia)}
					initialSelectedTags={entry.tags}
					isCreatingTag={isCreatingTag}
					isSaving={isSaving}
					isSearchingTags={isSearchingTags}
					onCancel={() => router.back()}
					onCreateTag={handleCreateTag}
					onSearchTags={handleSearchTags}
					onSubmit={handleSubmit}
					submitLabel="Save Changes"
					tagSuggestions={tagSuggestions}
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
});
