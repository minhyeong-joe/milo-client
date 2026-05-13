import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import type { DiaryTag } from "@/services/api/diary";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

const MAX_CONTENT_LENGTH = 500;
const MIN_TAG_SEARCH_LENGTH = 3;
const MAX_VISIBLE_TAG_SUGGESTIONS = 5;
const TAG_SEARCH_DELAY_MS = 300;

type DiaryEntryFormSubmitInput = {
	content: string;
	diaryDate: string;
	tagIds: string[];
};

type DiaryEntryFormProps = {
	error?: string | null;
	initialContent?: string;
	initialDate?: Date;
	initialSelectedTags?: DiaryTag[];
	isCreatingTag?: boolean;
	isSaving?: boolean;
	isSearchingTags?: boolean;
	onCancel: () => void;
	onCreateTag: (name: string) => Promise<DiaryTag>;
	onSearchTags: (search: string) => void;
	onSubmit: (input: DiaryEntryFormSubmitInput) => Promise<void> | void;
	submitLabel?: string;
	tagSuggestions: DiaryTag[];
};

export function DiaryEntryForm({
	error,
	initialContent = "",
	initialDate = new Date(),
	initialSelectedTags = [],
	isCreatingTag = false,
	isSaving = false,
	isSearchingTags = false,
	onCancel,
	onCreateTag,
	onSearchTags,
	onSubmit,
	submitLabel = "Save",
	tagSuggestions,
}: DiaryEntryFormProps) {
	const insets = useSafeAreaInsets();
	const scrollViewRef = useRef<ScrollView | null>(null);
	const tagsCardYRef = useRef(0);
	const [content, setContent] = useState(initialContent);
	const [date, setDate] = useState(initialDate);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [selectedTags, setSelectedTags] = useState<DiaryTag[]>(initialSelectedTags);
	const [tagInput, setTagInput] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [tagError, setTagError] = useState<string | null>(null);
	const [isTagInputFocused, setIsTagInputFocused] = useState(false);
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	const trimmedContent = content.trim();
	const trimmedTagInput = tagInput.trim();
	const canSubmit = trimmedContent.length > 0 && trimmedContent.length <= MAX_CONTENT_LENGTH;
	const footerBottomPadding = Math.max(insets.bottom, 12);
	const keyboardSuggestionPadding =
		isTagInputFocused && keyboardHeight > 0 ? keyboardHeight + spacing.xl : 0;

	const scrollTagsIntoView = useCallback(() => {
		requestAnimationFrame(() => {
			scrollViewRef.current?.scrollTo({
				animated: true,
				y: Math.max(tagsCardYRef.current - spacing.md, 0),
			});
		});
	}, []);

	const scrollTagsIntoViewAfterKeyboard = useCallback(() => {
		scrollTagsIntoView();
		setTimeout(scrollTagsIntoView, 160);
		setTimeout(scrollTagsIntoView, 360);
	}, [scrollTagsIntoView]);

	useEffect(() => {
		const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
			setKeyboardHeight(event.endCoordinates.height);

			if (isTagInputFocused) {
				scrollTagsIntoViewAfterKeyboard();
			}
		});
		const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
			setKeyboardHeight(0);
			setIsTagInputFocused(false);
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, [isTagInputFocused, scrollTagsIntoViewAfterKeyboard]);

	useEffect(() => {
		const search = trimmedTagInput;

		if (search.length < MIN_TAG_SEARCH_LENGTH) {
			onSearchTags("");
			return;
		}

		scrollTagsIntoViewAfterKeyboard();

		const timeoutId = setTimeout(() => {
			onSearchTags(search);
		}, TAG_SEARCH_DELAY_MS);

		return () => clearTimeout(timeoutId);
	}, [onSearchTags, scrollTagsIntoViewAfterKeyboard, trimmedTagInput]);

	const visibleSuggestions = useMemo(
		() => tagSuggestions.filter((tag) => !selectedTags.some((selected) => selected.id === tag.id)),
		[selectedTags, tagSuggestions],
	);
	const displayedSuggestions = visibleSuggestions.slice(0, MAX_VISIBLE_TAG_SUGGESTIONS);
	const hiddenSuggestionCount = Math.max(
		visibleSuggestions.length - displayedSuggestions.length,
		0,
	);

	const hasExactMatch = useMemo(() => {
		const normalizedInput = normalizeTagName(trimmedTagInput);
		if (!normalizedInput) {
			return false;
		}

		return [...tagSuggestions, ...selectedTags].some(
			(tag) => normalizeTagName(tag.name) === normalizedInput,
		);
	}, [selectedTags, tagSuggestions, trimmedTagInput]);

	const canCreateTag = trimmedTagInput.length >= MIN_TAG_SEARCH_LENGTH && !hasExactMatch;

	useEffect(() => {
		if (
			trimmedTagInput.length >= MIN_TAG_SEARCH_LENGTH &&
			(visibleSuggestions.length > 0 || canCreateTag)
		) {
			scrollTagsIntoViewAfterKeyboard();
		}
	}, [canCreateTag, scrollTagsIntoViewAfterKeyboard, trimmedTagInput.length, visibleSuggestions.length]);

	const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setShowDatePicker(false);
		}

		if (selectedDate) {
			setDate(selectedDate);
		}
	};

	const handleSubmit = async () => {
		if (!canSubmit) {
			setValidationError("Write a diary note before saving.");
			return;
		}

		setValidationError(null);
		await onSubmit({
			content: trimmedContent,
			diaryDate: toDateKey(date),
			tagIds: selectedTags.map((tag) => tag.id),
		});
	};

	const selectTag = (tag: DiaryTag) => {
		setSelectedTags((currentTags) =>
			currentTags.some((selectedTag) => selectedTag.id === tag.id)
				? currentTags
				: [...currentTags, tag],
		);
		setTagInput("");
		setTagError(null);
		setIsTagInputFocused(false);
		onSearchTags("");
	};

	const removeTag = (tagId: string) => {
		setSelectedTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
	};

	const handleCreateTag = async () => {
		if (!canCreateTag || isCreatingTag) {
			return;
		}

		setTagError(null);

		try {
			const tag = await onCreateTag(trimmedTagInput);
			selectTag(tag);
		} catch (caughtError) {
			setTagError(getTagErrorMessage(caughtError));
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.keyboardView}
		>
			<ScrollView
				ref={scrollViewRef}
				contentContainerStyle={[
					globalStyles.scrollContent,
					styles.content,
					{ paddingBottom: spacing.lg + footerBottomPadding + keyboardSuggestionPadding },
				]}
				keyboardShouldPersistTaps="handled"
			>
				<View style={globalStyles.card}>
					<Text style={styles.label}>Date</Text>
					<Pressable
						accessibilityRole="button"
						onPress={() => setShowDatePicker(true)}
						style={styles.dateButton}
					>
						<Ionicons color={colors.light.primary} name="calendar-outline" size={20} />
						<Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
					</Pressable>
					{showDatePicker ? (
						<DateTimePicker
							display={Platform.OS === "ios" ? "spinner" : "default"}
							maximumDate={new Date()}
							mode="date"
							onChange={handleDateChange}
							value={date}
						/>
					) : null}
				</View>

				<View style={globalStyles.card}>
					<View style={styles.labelRow}>
						<Text style={styles.label}>Note</Text>
						<Text style={styles.countText}>
							{content.length}/{MAX_CONTENT_LENGTH}
						</Text>
					</View>
					<TextInput
						maxLength={MAX_CONTENT_LENGTH}
						multiline
						onChangeText={setContent}
						placeholder="Capture a tiny moment from today."
						placeholderTextColor={colors.light.textSecondary}
						style={styles.textInput}
						textAlignVertical="top"
						value={content}
					/>
				</View>

				<View
					onLayout={(event) => {
						tagsCardYRef.current = event.nativeEvent.layout.y;
					}}
					style={globalStyles.card}
				>
					<Text style={styles.label}>Tags</Text>
					{selectedTags.length > 0 ? (
						<View style={styles.selectedTagRow}>
							{selectedTags.map((tag) => (
								<Pressable
									accessibilityLabel={`Remove ${tag.name}`}
									key={tag.id}
									onPress={() => removeTag(tag.id)}
									style={styles.selectedTag}
								>
									<DiaryTagPill tag={tag} />
									<Ionicons color={colors.light.textSecondary} name="close-circle" size={16} />
								</Pressable>
							))}
						</View>
					) : null}

					<View style={styles.tagInputRow}>
						<Ionicons color={colors.light.textSecondary} name="pricetag-outline" size={18} />
						<TextInput
							autoCapitalize="words"
							onChangeText={setTagInput}
							onFocus={() => {
								setIsTagInputFocused(true);
								scrollTagsIntoViewAfterKeyboard();
							}}
							placeholder="Search or create a tag"
							placeholderTextColor={colors.light.textSecondary}
							style={styles.tagInput}
							value={tagInput}
						/>
						{isSearchingTags ? (
							<Text style={styles.helperText}>Searching...</Text>
						) : null}
					</View>

					{trimmedTagInput.length >= MIN_TAG_SEARCH_LENGTH ? (
						<View style={styles.suggestionList}>
							{displayedSuggestions.map((tag) => (
								<Pressable
									key={tag.id}
									onPress={() => selectTag(tag)}
									style={styles.suggestionRow}
								>
									<DiaryTagPill tag={tag} />
									<Text style={styles.scopeText}>{tag.scope === "global" ? "Default" : "Custom"}</Text>
								</Pressable>
							))}
							{hiddenSuggestionCount > 0 ? (
								<Text style={styles.helperText}>Showing top 5 matches</Text>
							) : null}
							{canCreateTag ? (
								<Pressable
									disabled={isCreatingTag}
									onPress={handleCreateTag}
									style={styles.createTagButton}
								>
									<Ionicons color={colors.light.primary} name="add-circle-outline" size={18} />
									<Text style={styles.createTagText}>
										{isCreatingTag ? "Creating..." : `Create "${trimmedTagInput}"`}
									</Text>
								</Pressable>
							) : null}
						</View>
					) : null}

					{tagError ? <Text style={styles.errorText}>{tagError}</Text> : null}
				</View>

				<View style={globalStyles.card}>
					<Pressable 
						accessibilityRole="button"
						onPress={() => undefined}
						style={styles.mediaPlaceholder}
					>
						<Ionicons color={colors.light.textSecondary} name="image-outline" size={24} />
						<Text style={styles.helperText}>Add Photo or Video</Text>
					</Pressable>
				</View>

				{validationError || error ? (
					<Text style={styles.errorText}>{validationError ?? error}</Text>
				) : null}

				<View style={[styles.footerRow, { marginBottom: footerBottomPadding }]}>
					<Pressable onPress={onCancel} style={[styles.footerButton, styles.secondaryButton]}>
						<Text style={styles.secondaryButtonText}>Cancel</Text>
					</Pressable>
					<Pressable
						disabled={!canSubmit || isSaving}
						onPress={handleSubmit}
						style={[
							styles.footerButton,
							styles.primaryButton,
							(!canSubmit || isSaving) && styles.disabledButton,
						]}
					>
						<Text style={styles.primaryButtonText}>{isSaving ? "Saving..." : submitLabel}</Text>
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function formatDisplayDate(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
}

function getTagErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not create this tag.";
}

function normalizeTagName(value: string) {
	return value.trim().toLocaleLowerCase();
}

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	countText: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	createTagButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	createTagText: {
		...typography.caption,
		color: colors.light.primary,
	},
	dateButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.md,
	},
	dateText: {
		...typography.body,
		color: colors.light.textPrimary,
		fontWeight: "700",
	},
	disabledButton: {
		opacity: 0.45,
	},
	errorText: {
		...typography.caption,
		color: colors.light.error,
	},
	footerButton: {
		alignItems: "center",
		borderRadius: 12,
		flex: 1,
		paddingVertical: spacing.md,
	},
	footerRow: {
		flexDirection: "row",
		gap: spacing.md,
	},
	helperText: {
		...typography.caption,
		color: colors.light.textSecondary,
		lineHeight: 18,
	},
	keyboardView: {
		flex: 1,
	},
	label: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	labelRow: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	mediaPlaceholder: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 12,
		borderStyle: "dashed",
		borderWidth: 1,
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.lg,
	},
	primaryButton: {
		backgroundColor: colors.light.primary,
	},
	primaryButtonText: {
		...typography.label,
		color: colors.light.surface,
	},
	scopeText: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	secondaryButton: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderWidth: 1,
	},
	secondaryButtonText: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	selectedTag: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 999,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.xs,
		paddingRight: spacing.xs,
	},
	selectedTagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	suggestionList: {
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	suggestionRow: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: spacing.xs,
	},
	tagInput: {
		...typography.body,
		color: colors.light.textPrimary,
		flex: 1,
		paddingVertical: 0,
	},
	tagInputRow: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.md,
	},
	textInput: {
		...typography.body,
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		color: colors.light.textPrimary,
		marginTop: spacing.sm,
		minHeight: 150,
		padding: spacing.md,
	},
});
