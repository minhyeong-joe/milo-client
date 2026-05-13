import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiaryEntryForm } from "@/components/diary/DiaryEntryForm";
import { useBabySelection } from "@/context/BabySelectionContext";
import { createDiaryEntry, type DiaryTag } from "@/services/api/diary";
import { ApiError } from "@/services/api/httpClient";
import { createTag, listTags } from "@/services/api/tags";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

export default function AddDiaryScreen() {
	const router = useRouter();
	const { selectedBaby } = useBabySelection();
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
		tagIds: string[];
	}) => {
		if (!selectedBaby) {
			setError("Choose a baby before saving a diary entry.");
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			await createDiaryEntry(selectedBaby.id, {
				content: input.content,
				diaryDate: input.diaryDate,
				media: [],
				tagIds: input.tagIds,
			});
			router.back();
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
				<Text style={styles.headerTitle}>New Diary</Text>
				<View style={styles.iconButton} />
			</View>

			{selectedBaby ? (
				<DiaryEntryForm
					error={error}
					isCreatingTag={isCreatingTag}
					isSaving={isSaving}
					isSearchingTags={isSearchingTags}
					onCancel={() => router.back()}
					onCreateTag={handleCreateTag}
					onSearchTags={handleSearchTags}
					onSubmit={handleSubmit}
					submitLabel="Save"
					tagSuggestions={tagSuggestions}
				/>
			) : (
				<View style={globalStyles.screenContent}>
					<View style={globalStyles.card}>
						<Text style={globalStyles.sectionTitleText}>No baby selected</Text>
						<Text style={globalStyles.bodyText}>
							Choose a baby on Home before adding diary entries.
						</Text>
					</View>
				</View>
			)}
		</SafeAreaView>
	);
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
