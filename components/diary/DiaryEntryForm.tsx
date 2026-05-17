import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
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

import {
	DiaryMediaPreview,
	type DiaryMediaPreviewItem,
} from "@/components/diary/DiaryMediaPreview";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import {
	createDiaryMediaUpload,
	removeDiaryMediaUpload,
	type DiaryMediaInput,
	type DiaryTag,
} from "@/services/api/diary";
import {
	DIARY_MEDIA_LIMITS,
	isDiaryPhotoContentType,
	isDiaryVideoContentType,
	type DiaryMediaContentType,
} from "@/services/diary/diaryMediaConfig";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppPreferences, useAppTheme } from "@/context/AppPreferencesContext";

const MAX_CONTENT_LENGTH = 500;
const MAX_TITLE_LENGTH = 80;

type TagFilterKey = "milestone" | "emotion" | "event" | "custom";

const TAG_FILTERS: { color: string; key: TagFilterKey; label: string }[] = [
	{ color: "#F59E0B", key: "milestone", label: "Milestone" },
	{ color: "#EC4899", key: "emotion", label: "Emotions" },
	{ color: "#38BDF8", key: "event", label: "Events" },
	{ color: "#64748B", key: "custom", label: "Custom" },
];

const DEFAULT_TAG_FILTER: TagFilterKey = "milestone";

type DiaryEntryFormSubmitInput = {
	content: string;
	diaryDate: string;
	media: DiaryMediaInput[];
	tagIds: string[];
	title: string | null;
};

export type UploadedDiaryMedia = DiaryMediaInput & {
	isNew?: boolean;
	localUri: string;
	mediaUrl?: string | null;
	thumbnailLocalUri?: string | null;
	thumbnailUrl?: string | null;
};

type PendingMediaUpload = {
	blob: Blob;
	fileType: DiaryMediaContentType;
	kind: "photo" | "video";
	localUri: string;
	sizeBytes: number;
	thumbnail?: {
		blob: Blob;
		fileType: "image/jpeg";
		localUri: string;
		sizeBytes: number;
	};
};

type DiaryEntryFormProps = {
	babyId?: string;
	error?: string | null;
	initialContent?: string;
	initialDate?: Date;
	initialMedia?: UploadedDiaryMedia[];
	initialSelectedTags?: DiaryTag[];
	initialTitle?: string | null;
	isCreatingTag?: boolean;
	isLoadingTags?: boolean;
	isOnline?: boolean;
	isSaving?: boolean;
	onCancel: () => void;
	onCreateTag: (name: string) => Promise<DiaryTag>;
	onSubmit: (input: DiaryEntryFormSubmitInput) => Promise<void> | void;
	submitLabel?: string;
	timeZone?: string;
	availableTags: DiaryTag[];
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function DiaryEntryForm({
	babyId,
	error,
	initialContent = "",
	initialDate = new Date(),
	initialMedia = [],
	initialSelectedTags = [],
	initialTitle = "",
	isCreatingTag = false,
	isLoadingTags = false,
	isOnline = true,
	isSaving = false,
	onCancel,
	onCreateTag,
	onSubmit,
	submitLabel = "Save",
	timeZone,
	availableTags,
}: DiaryEntryFormProps) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	const insets = useSafeAreaInsets();
	const scrollViewRef = useRef<ScrollView | null>(null);
	const tagsCardYRef = useRef(0);
	const [content, setContent] = useState(initialContent);
	const [date, setDate] = useState(initialDate);
	const [title, setTitle] = useState(initialTitle ?? "");
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [selectedTags, setSelectedTags] = useState<DiaryTag[]>(initialSelectedTags);
	const [tagInput, setTagInput] = useState("");
	const [selectedTagFilter, setSelectedTagFilter] =
		useState<TagFilterKey>(DEFAULT_TAG_FILTER);
	const [isTagPoolExpanded, setIsTagPoolExpanded] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [tagError, setTagError] = useState<string | null>(null);
	const [isTagInputFocused, setIsTagInputFocused] = useState(false);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const [uploadedMedia, setUploadedMedia] = useState<UploadedDiaryMedia[]>(initialMedia);
	const [isUploadingMedia, setIsUploadingMedia] = useState(false);
	const [mediaError, setMediaError] = useState<string | null>(null);
	const [mediaUploadProgress, setMediaUploadProgress] = useState<{
		completed: number;
		total: number;
	} | null>(null);

	const trimmedContent = content.trim();
	const trimmedTitle = title.trim();
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

	const visibleTags = useMemo(() => {
		const normalizedSearch = normalizeTagName(trimmedTagInput);
		const selectedTagIds = new Set(selectedTags.map((tag) => tag.id));

		return availableTags
			.filter((tag) => !selectedTagIds.has(tag.id))
			.filter((tag) => isTagFilterMatch(tag, selectedTagFilter))
			.filter((tag) =>
				normalizedSearch.length > 0
					? normalizeTagName(tag.name).includes(normalizedSearch)
					: true,
			)
			.sort((left, right) => left.name.localeCompare(right.name));
	}, [availableTags, selectedTagFilter, selectedTags, trimmedTagInput]);

	const hasExactMatch = useMemo(() => {
		const normalizedInput = normalizeTagName(trimmedTagInput);
		if (!normalizedInput) {
			return false;
		}

		return [...availableTags, ...selectedTags].some(
			(tag) => normalizeTagName(tag.name) === normalizedInput,
		);
	}, [availableTags, selectedTags, trimmedTagInput]);

	const canCreateTag = trimmedTagInput.length > 0 && !hasExactMatch;
	const shouldCollapseTagPool = trimmedTagInput.length === 0 && !isTagPoolExpanded;
	const canToggleTagPool = trimmedTagInput.length === 0 && visibleTags.length > 12;

	useEffect(() => {
		if (isTagInputFocused) {
			scrollTagsIntoViewAfterKeyboard();
		}
	}, [isTagInputFocused, scrollTagsIntoViewAfterKeyboard, trimmedTagInput.length, visibleTags.length]);

	const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setShowDatePicker(false);
		}

		if (selectedDate) {
			setDate(selectedDate);
		}
	};

	const handleSubmit = async () => {
		if (!isOnline) {
			setValidationError(DIARY_OFFLINE_MESSAGE);
			return;
		}

		if (!canSubmit) {
			setValidationError("Write a diary note before saving.");
			return;
		}

		setValidationError(null);
		await onSubmit({
			content: trimmedContent,
			diaryDate: toDateKey(date),
			media: uploadedMedia.map(
				({
					isNew: _isNew,
					localUri: _localUri,
					mediaUrl: _mediaUrl,
					thumbnailLocalUri: _thumbnailLocalUri,
					thumbnailUrl: _thumbnailUrl,
					...media
				}, index) => ({
					...media,
					sortOrder: index,
				}),
			),
			tagIds: selectedTags.map((tag) => tag.id),
			title: trimmedTitle.length > 0 ? trimmedTitle : null,
		});
	};

	const handleCancel = async () => {
		if (babyId) {
			await cleanupNewMediaUploads(babyId, uploadedMedia);
		}

		onCancel();
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

	const selectTagFilter = (filter: TagFilterKey) => {
		setSelectedTagFilter(filter);
	};

	const addMedia = async () => {
		if (!babyId || isUploadingMedia) {
			return;
		}

		if (!isOnline) {
			setMediaError(DIARY_OFFLINE_MESSAGE);
			return;
		}

		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (!permission.granted) {
			Alert.alert(
				"Photos permission needed",
				"Allow photo library access to add diary photos and videos.",
			);
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			allowsMultipleSelection: true,
			mediaTypes: ["images", "videos"],
			quality: 0.85,
			videoMaxDuration: DIARY_MEDIA_LIMITS.MAX_VIDEO_DURATION_SECONDS,
		});

		if (result.canceled || result.assets.length === 0) {
			return;
		}

		setIsUploadingMedia(true);
		setMediaUploadProgress(null);
		setMediaError(null);

		try {
			const pendingUploads: PendingMediaUpload[] = [];

			for (const asset of result.assets) {
				pendingUploads.push(await prepareMediaUpload(asset));
			}

			const validationError = getMediaLimitError(uploadedMedia, pendingUploads);

			if (validationError) {
				setMediaError(validationError);
				return;
			}

			const nextMedia: UploadedDiaryMedia[] = [];
			setMediaUploadProgress({ completed: 0, total: pendingUploads.length });

			for (const [index, pendingUpload] of pendingUploads.entries()) {
				const upload = await createDiaryMediaUpload(babyId, {
					fileType: pendingUpload.fileType,
					sizeBytes: pendingUpload.sizeBytes,
				});
				const uploadResponse = await fetch(upload.uploadUrl, {
					body: pendingUpload.blob,
					headers: {
						"Content-Type": pendingUpload.fileType,
					},
					method: "PUT",
				});

				if (!uploadResponse.ok) {
					throw new Error("Could not upload diary media. Please try again.");
				}

				nextMedia.push({
					description: null,
					fileType: pendingUpload.fileType,
					isNew: true,
					localUri: pendingUpload.localUri,
					objectKey: upload.objectKey,
					sizeBytes: pendingUpload.sizeBytes,
					sortOrder: uploadedMedia.length + index,
				});
				const uploadedItem = nextMedia[nextMedia.length - 1];

				if (pendingUpload.kind === "video" && pendingUpload.thumbnail) {
					const thumbnailUpload = await createDiaryMediaUpload(babyId, {
						fileType: pendingUpload.thumbnail.fileType,
						sizeBytes: pendingUpload.thumbnail.sizeBytes,
						uploadPurpose: "thumbnail",
					});
					const thumbnailUploadResponse = await fetch(thumbnailUpload.uploadUrl, {
						body: pendingUpload.thumbnail.blob,
						headers: {
							"Content-Type": pendingUpload.thumbnail.fileType,
						},
						method: "PUT",
					});

					if (thumbnailUploadResponse.ok) {
						uploadedItem.thumbnailFileType = pendingUpload.thumbnail.fileType;
						uploadedItem.thumbnailLocalUri = pendingUpload.thumbnail.localUri;
						uploadedItem.thumbnailObjectKey = thumbnailUpload.objectKey;
						uploadedItem.thumbnailSizeBytes = pendingUpload.thumbnail.sizeBytes;
					} else {
						console.warn("Could not upload diary video thumbnail.");
					}
				}
				setMediaUploadProgress((currentProgress) =>
					currentProgress
						? {
								...currentProgress,
								completed: currentProgress.completed + 1,
							}
						: currentProgress,
				);
			}

			setUploadedMedia((currentMedia) => [...currentMedia, ...nextMedia]);
		} catch (caughtError) {
			setMediaError(getMediaErrorMessage(caughtError));
		} finally {
			setIsUploadingMedia(false);
			setMediaUploadProgress(null);
		}
	};

	const removeMedia = async (objectKey: string) => {
		const removedMedia = uploadedMedia.find((media) => media.objectKey === objectKey);
		setUploadedMedia((currentMedia) =>
			currentMedia.filter((media) => media.objectKey !== objectKey),
		);
		setMediaError(null);

		if (!babyId || !removedMedia?.isNew) {
			return;
		}

		try {
			await removeDiaryMediaUpload(babyId, { objectKey });
			if (removedMedia?.thumbnailObjectKey) {
				await removeDiaryMediaUpload(babyId, {
					objectKey: removedMedia.thumbnailObjectKey,
				});
			}
		} catch (caughtError) {
			console.warn(caughtError);
			setMediaError("Removed from this entry. Cloud cleanup will retry later.");
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
						<Ionicons color={themeColors.primary} name="calendar-outline" size={20} />
						<Text style={styles.dateText}>
							{formatDisplayDate(date, timeZone, languagePreference)}
						</Text>
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
						<Text style={styles.label}>Title</Text>
						<Text style={styles.countText}>
							{title.length}/{MAX_TITLE_LENGTH}
						</Text>
					</View>
					<TextInput
						maxLength={MAX_TITLE_LENGTH}
						onChangeText={setTitle}
						placeholder="Give this memory a title"
						placeholderTextColor={themeColors.textSecondary}
						style={styles.titleInput}
						value={title}
					/>
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
						placeholderTextColor={themeColors.textSecondary}
						style={styles.textInput}
						textAlignVertical="top"
						value={content}
					/>
				</View>

				<View style={globalStyles.card}>
					<Pressable
						accessibilityRole="button"
						disabled={isUploadingMedia}
						onPress={addMedia}
						style={styles.mediaPlaceholder}
					>
						<Ionicons color={themeColors.textSecondary} name="image-outline" size={24} />
						<Text style={styles.helperText}>
							{isUploadingMedia ? "Uploading..." : "Add Photo or Video"}
						</Text>
					</Pressable>
					{mediaUploadProgress ? (
						<View style={styles.uploadProgressWrap}>
							<View style={styles.uploadProgressTrack}>
								<View
									style={[
										styles.uploadProgressFill,
										{
											width: `${Math.round(
												(mediaUploadProgress.completed / mediaUploadProgress.total) * 100,
											)}%`,
										},
									]}
								/>
							</View>
							<Text style={styles.helperText}>
								Uploading {mediaUploadProgress.completed} of {mediaUploadProgress.total}...
							</Text>
						</View>
					) : null}
					<DiaryMediaPreview
						media={uploadedMedia.map(toMediaPreviewItem)}
						onRemove={removeMedia}
						variant="form"
					/>
					{mediaError ? <Text style={styles.errorText}>{mediaError}</Text> : null}
				</View>

				<View
					onLayout={(event) => {
						tagsCardYRef.current = event.nativeEvent.layout.y;
					}}
					style={globalStyles.card}
				>
					<View style={styles.labelRow}>
						<Text style={styles.label}>Tags</Text>
						{isLoadingTags ? <Text style={styles.helperText}>Loading...</Text> : null}
					</View>
					{selectedTags.length > 0 ? (
						<View style={styles.selectedTagRow}>
							{selectedTags
								.slice()
								.sort((left, right) => left.name.localeCompare(right.name))
								.map((tag) => (
									<Pressable
										accessibilityLabel={`Remove ${tag.name}`}
										key={tag.id}
										onPress={() => removeTag(tag.id)}
										style={styles.selectedTag}
									>
										<DiaryTagPill tag={tag} />
										<Ionicons color={themeColors.textSecondary} name="close-circle" size={16} />
									</Pressable>
								))}
						</View>
					) : null}

					<View style={styles.tagFilterRow}>
						{TAG_FILTERS.map((filter) => (
							<Pressable
								accessibilityRole="button"
								key={filter.key}
								onPress={() => selectTagFilter(filter.key)}
								style={[
									styles.tagFilterButton,
									{ borderColor: filter.color },
									selectedTagFilter === filter.key && {
										backgroundColor: getTagFilterBackground(filter.color),
									},
								]}
							>
								<Text
									style={[
										styles.tagFilterText,
										{ color: filter.color },
									]}
								>
									{filter.label}
								</Text>
							</Pressable>
						))}
					</View>

					<View style={styles.tagInputRow}>
						<Ionicons color={themeColors.textSecondary} name="search-outline" size={18} />
						<TextInput
							autoCapitalize="words"
							onChangeText={setTagInput}
							onFocus={() => {
								setIsTagInputFocused(true);
								scrollTagsIntoViewAfterKeyboard();
							}}
							placeholder="Search or create a tag"
							placeholderTextColor={themeColors.textSecondary}
							style={styles.tagInput}
							value={tagInput}
						/>
					</View>

					<View
						style={[
							styles.suggestionList,
							shouldCollapseTagPool && styles.suggestionListCollapsed,
						]}
					>
						{visibleTags.map((tag) => (
							<Pressable
								key={tag.id}
								onPress={() => selectTag(tag)}
								style={styles.suggestionRow}
							>
								<DiaryTagPill tag={tag} />
							</Pressable>
						))}
						{visibleTags.length === 0 && !canCreateTag ? (
							<Text style={styles.helperText}>No matching tags.</Text>
						) : null}
						{canCreateTag ? (
							<Pressable
								disabled={isCreatingTag}
								onPress={handleCreateTag}
								style={styles.createTagButton}
							>
								<Ionicons color={themeColors.primary} name="add-circle-outline" size={18} />
								<Text style={styles.createTagText}>
									{isCreatingTag ? "Creating..." : `Create "${trimmedTagInput}"`}
								</Text>
							</Pressable>
						) : null}
					</View>
					{canToggleTagPool ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => setIsTagPoolExpanded((currentValue) => !currentValue)}
							style={styles.showMoreTagsButton}
						>
							<Text style={styles.showMoreTagsText}>
								{isTagPoolExpanded ? "Show less" : "Show more"}
							</Text>
							<Ionicons
								color={themeColors.primary}
								name={isTagPoolExpanded ? "chevron-up" : "chevron-down"}
								size={16}
							/>
						</Pressable>
					) : null}

					{tagError ? <Text style={styles.errorText}>{tagError}</Text> : null}
				</View>

				{validationError || error ? (
					<Text style={styles.errorText}>{validationError ?? error}</Text>
				) : null}

				<View style={[styles.footerRow, { marginBottom: footerBottomPadding }]}>
					<Pressable onPress={() => void handleCancel()} style={[styles.footerButton, styles.secondaryButton]}>
						<Text style={styles.secondaryButtonText}>Cancel</Text>
					</Pressable>
					<Pressable
						disabled={!isOnline || !canSubmit || isSaving || isUploadingMedia}
						onPress={handleSubmit}
						style={[
							styles.footerButton,
							styles.primaryButton,
							(!isOnline || !canSubmit || isSaving || isUploadingMedia) && styles.disabledButton,
						]}
					>
						<Text style={styles.primaryButtonText}>
							{isSaving ? "Saving..." : submitLabel}
						</Text>
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function formatDisplayDate(date: Date, timeZone?: string, locale = "en-US") {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		timeZone,
		year: "numeric",
	}).format(date);
}

function getTagErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not create this tag.";
}

async function prepareMediaUpload(
	asset: ImagePicker.ImagePickerAsset,
): Promise<PendingMediaUpload> {
	const fileType = getAssetContentType(asset);
	const kind = getAssetMediaKind(asset, fileType);
	const durationSeconds = getAssetDurationSeconds(asset.duration);

	if (kind === "video" && durationSeconds > DIARY_MEDIA_LIMITS.MAX_VIDEO_DURATION_SECONDS) {
		throw new Error(`Videos must be ${DIARY_MEDIA_LIMITS.MAX_VIDEO_DURATION_SECONDS} seconds or shorter.`);
	}

	const response = await fetch(asset.uri);
	const blob = await response.blob();
	const sizeBytes = asset.fileSize ?? blob.size;

	return {
		blob,
		fileType,
		kind,
		localUri: asset.uri,
		sizeBytes,
		thumbnail: kind === "video"
			? await createVideoThumbnail(asset.uri)
			: undefined,
	};
}

async function createVideoThumbnail(uri: string): Promise<PendingMediaUpload["thumbnail"]> {
	for (const time of [1000, 0]) {
		try {
			const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
				quality: 0.75,
				time,
			});
			const response = await fetch(thumbnail.uri);
			const blob = await response.blob();

			return {
				blob,
				fileType: "image/jpeg",
				localUri: thumbnail.uri,
				sizeBytes: blob.size,
			};
		} catch (error) {
			if (time === 0) {
				console.warn("Could not generate diary video thumbnail.", error);
			}
		}
	}

	return undefined;
}

function getAssetContentType(asset: ImagePicker.ImagePickerAsset): DiaryMediaContentType {
	if (asset.mimeType && isSupportedDiaryMediaContentType(asset.mimeType)) {
		return asset.mimeType;
	}

	const extension = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();
	const assetKind = getAssetMediaKind(asset, null);

	if (extension === "png") {
		return "image/png";
	}

	if (extension === "webp") {
		return "image/webp";
	}

	if (extension === "mov") {
		return "video/quicktime";
	}

	if (extension === "mp4" || extension === "m4v") {
		return "video/mp4";
	}

	if (assetKind === "video") {
		return "video/mp4";
	}

	return "image/jpeg";
}

function getAssetMediaKind(
	asset: ImagePicker.ImagePickerAsset,
	fileType: DiaryMediaContentType | null,
): "photo" | "video" {
	if (fileType && isDiaryVideoContentType(fileType)) {
		return "video";
	}

	if (fileType && isDiaryPhotoContentType(fileType)) {
		return "photo";
	}

	const assetType = String(asset.type ?? "").toLowerCase();
	const mimeType = String(asset.mimeType ?? "").toLowerCase();
	const extension = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();

	if (
		assetType.includes("video") ||
		mimeType.startsWith("video/") ||
		extension === "mp4" ||
		extension === "mov" ||
		extension === "m4v"
	) {
		return "video";
	}

	return "photo";
}

function getAssetDurationSeconds(duration?: number | null) {
	if (!duration) {
		return 0;
	}

	return duration > 1000 ? duration / 1000 : duration;
}

const DIARY_OFFLINE_MESSAGE =
	"Diary is unavailable offline because entries may include media. Reconnect to view or add diary entries.";

function getMediaErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not upload diary media.";
}

async function cleanupNewMediaUploads(babyId: string, media: UploadedDiaryMedia[]) {
	await Promise.all(
		media
			.filter((item) => item.isNew)
			.flatMap((item) => [item.objectKey, item.thumbnailObjectKey].filter(isString))
			.map(async (objectKey) => {
				try {
					await removeDiaryMediaUpload(babyId, { objectKey });
				} catch (error) {
					console.warn("Could not cleanup unsaved diary media.", error);
				}
			}),
	);
}

function isString(value: string | null | undefined): value is string {
	return typeof value === "string" && value.length > 0;
}

function getMediaKind(fileType: string) {
	if (isDiaryPhotoContentType(fileType)) {
		return "photo";
	}

	if (isDiaryVideoContentType(fileType)) {
		return "video";
	}

	return "unknown";
}

function getMediaLimitError(
	currentMedia: UploadedDiaryMedia[],
	pendingUploads: PendingMediaUpload[],
) {
	const allMedia = [...currentMedia, ...pendingUploads];
	const photoCount = allMedia.filter((media) => getMediaKind(media.fileType) === "photo").length;
	const videoCount = allMedia.filter((media) => getMediaKind(media.fileType) === "video").length;
	const totalSizeBytes = allMedia.reduce((sum, media) => sum + media.sizeBytes, 0);

	if (photoCount > DIARY_MEDIA_LIMITS.MAX_PHOTOS) {
		return `You can add up to ${DIARY_MEDIA_LIMITS.MAX_PHOTOS} photos per diary entry.`;
	}

	if (videoCount > DIARY_MEDIA_LIMITS.MAX_VIDEOS) {
		return `You can add up to ${DIARY_MEDIA_LIMITS.MAX_VIDEOS} video per diary entry.`;
	}

	for (const media of allMedia) {
		const kind = getMediaKind(media.fileType);

		if (kind === "photo" && media.sizeBytes > DIARY_MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
			return `Each photo must be ${formatBytes(DIARY_MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES)} or smaller.`;
		}

		if (kind === "video" && media.sizeBytes > DIARY_MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES) {
			return `Each video must be ${formatBytes(DIARY_MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES)} or smaller.`;
		}
	}

	if (totalSizeBytes > DIARY_MEDIA_LIMITS.MAX_TOTAL_SIZE_BYTES) {
		return `Total media must be ${formatBytes(DIARY_MEDIA_LIMITS.MAX_TOTAL_SIZE_BYTES)} or less.`;
	}

	return null;
}

function formatBytes(value: number) {
	return `${Math.round(value / (1024 * 1024))} MB`;
}

function isSupportedDiaryMediaContentType(value: string): value is DiaryMediaContentType {
	return isDiaryPhotoContentType(value) || isDiaryVideoContentType(value);
}

function toMediaPreviewItem(media: UploadedDiaryMedia): DiaryMediaPreviewItem {
	return {
		description: media.description ?? null,
		fileType: media.fileType,
		localUri: media.localUri,
		mediaUrl: media.mediaUrl ?? null,
		objectKey: media.objectKey,
		sizeBytes: media.sizeBytes,
		thumbnailFileType: media.thumbnailFileType ?? null,
		thumbnailLocalUri: media.thumbnailLocalUri,
		thumbnailObjectKey: media.thumbnailObjectKey ?? null,
		thumbnailSizeBytes: media.thumbnailSizeBytes ?? null,
		thumbnailUrl: media.thumbnailUrl ?? null,
	};
}

function normalizeTagName(value: string) {
	return value.trim().toLocaleLowerCase();
}

function getTagFilterBackground(color: string) {
	return `${color}1F`;
}

function isTagFilterMatch(tag: DiaryTag, filter: TagFilterKey) {
	if (filter === "custom") {
		return tag.scope === "custom";
	}

	return tag.scope !== "custom" && tag.type === filter;
}

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	countText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	createTagButton: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	createTagText: {
		...typography.caption,
		color: themeColors.primary,
	},
	dateButton: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.md,
	},
	dateText: {
		...typography.body,
		color: themeColors.textPrimary,
		fontWeight: "700",
	},
	disabledButton: {
		opacity: 0.45,
	},
	errorText: {
		...typography.caption,
		color: themeColors.error,
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
		color: themeColors.textSecondary,
		lineHeight: 18,
	},
	keyboardView: {
		flex: 1,
	},
	label: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	labelRow: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	mediaPlaceholder: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 12,
		borderStyle: "dashed",
		borderWidth: 1,
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.lg,
	},
	primaryButton: {
		backgroundColor: themeColors.primary,
	},
	primaryButtonText: {
		...typography.label,
		color: themeColors.surface,
	},
	secondaryButton: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderWidth: 1,
	},
	secondaryButtonText: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	selectedTag: {
		alignItems: "center",
		borderColor: themeColors.border,
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
	showMoreTagsButton: {
		alignItems: "center",
		alignSelf: "center",
		flexDirection: "row",
		gap: spacing.xs,
		marginTop: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	showMoreTagsText: {
		...typography.caption,
		color: themeColors.primary,
		fontWeight: "800",
	},
	suggestionList: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	suggestionListCollapsed: {
		maxHeight: 104,
		overflow: "hidden",
	},
	suggestionRow: {
		alignItems: "center",
		alignSelf: "flex-start",
	},
	tagInput: {
		...typography.body,
		color: themeColors.textPrimary,
		flex: 1,
		paddingVertical: 0,
	},
	tagInputRow: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
		padding: spacing.md,
	},
	tagFilterButton: {
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	tagFilterRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	tagFilterText: {
		...typography.caption,
		fontWeight: "700",
	},
	textInput: {
		...typography.body,
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		color: themeColors.textPrimary,
		marginTop: spacing.sm,
		minHeight: 150,
		padding: spacing.md,
	},
	titleInput: {
		...typography.body,
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		color: themeColors.textPrimary,
		marginTop: spacing.sm,
		padding: spacing.md,
	},
	uploadProgressFill: {
		backgroundColor: themeColors.primary,
		borderRadius: 999,
		height: "100%",
	},
	uploadProgressTrack: {
		backgroundColor: themeColors.border,
		borderRadius: 999,
		height: 6,
		overflow: "hidden",
		width: "100%",
	},
	uploadProgressWrap: {
		gap: spacing.xs,
		marginTop: spacing.md,
	},
});
}
