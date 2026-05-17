import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { SettingsHeader } from "@/components/settings/SettingsRows";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import { useSync } from "@/context/SyncContext";
import type { DiaryTag } from "@/services/api/diary";
import { deleteTag, listTags, updateTag } from "@/services/api/tags";
import {
	enqueueTagMutation,
	loadCachedTags,
	markTagDeleted,
	saveTagsCache,
	upsertPendingTag,
} from "@/services/tags/tagOfflineStore";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TAG_COLORS = [
	"#7C5CE7",
	"#D84D8B",
	"#F97316",
	"#2FAE62",
	"#0EA5E9",
	"#64748B",
];
const DEFAULT_TAG_TYPE_ORDER = ["milestone", "emotions", "event"];

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function MilestoneTagsScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { session } = useAuthSession();
	const { selectedBaby } = useBabySelection();
	const { removeTagFromDiaryCache, updateTagInDiaryCache } = useDiaryCache();
	const { connectionStatus, markOffline, markOnline, syncNow } = useSync();
	const [tags, setTags] = useState<DiaryTag[]>([]);
	const [selectedTag, setSelectedTag] = useState<DiaryTag | null>(null);
	const [name, setName] = useState("");
	const [color, setColor] = useState(TAG_COLORS[0]);
	const [error, setError] = useState<string | null>(null);
	const [infoMessage, setInfoMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [areDefaultTagsExpanded, setAreDefaultTagsExpanded] = useState(false);

	const customTags = useMemo(
		() => tags.filter((tag) => tag.scope === "custom").sort(sortTags),
		[tags],
	);
	const globalTags = useMemo(
		() => tags.filter((tag) => tag.scope === "global").sort(sortTags),
		[tags],
	);
	const globalTagsByType = useMemo(() => groupTagsByType(globalTags), [globalTags]);
	const previewTag = selectedTag
		? { ...selectedTag, color, name: name.trim() || selectedTag.name }
		: null;

	const load = useCallback(async ({ forceNetwork = false }: { forceNetwork?: boolean } = {}) => {
		if (!selectedBaby) {
			setTags([]);
			return;
		}

		setIsLoading(true);
		setError(null);
		setInfoMessage(null);

		try {
			if (!session) {
				setTags([]);
				return;
			}

			const cachedTags = await loadCachedTags(session.user.id, selectedBaby.id);
			if (cachedTags.length > 0) {
				setTags(cachedTags);
			}

			if (connectionStatus !== "online" && !forceNetwork) {
				return;
			}

			if (forceNetwork || cachedTags.some((tag) => tag.syncStatus === "pending" || tag.syncStatus === "failed")) {
				const syncSucceeded = await syncNow({
					babyId: selectedBaby.id,
					scope: "tags",
				});

				if (!syncSucceeded && forceNetwork) {
					return;
				}
			}

			const response = await listTags({ babyId: selectedBaby.id });
			await saveTagsCache(session.user.id, selectedBaby.id, response.tags);
			const mergedTags = await loadCachedTags(session.user.id, selectedBaby.id);
			setTags(mergedTags);
			setSelectedTag((currentTag) =>
				currentTag
					? mergedTags.find((tag) => tag.id === currentTag.id) ?? null
					: null,
			);
			markOnline();
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
			markOffline();
		} finally {
			setIsLoading(false);
		}
	}, [connectionStatus, markOffline, markOnline, selectedBaby, session, syncNow]);

	useEffect(() => {
		void load();
	}, [load]);

	const selectTag = (tag: DiaryTag) => {
		if (tag.scope === "global") {
			setSelectedTag(null);
			setInfoMessage(null);
			setError("Default tags are shared and read-only.");
			return;
		}

		setSelectedTag(tag);
		setName(tag.name);
		setColor(tag.color);
		setError(null);
		setInfoMessage(null);
	};

	const saveTag = async () => {
		if (!selectedBaby || !selectedTag || !session) {
			return;
		}

		const trimmedName = name.trim();

		if (!trimmedName) {
			setInfoMessage(null);
			setError("Tag name is required.");
			return;
		}

		setIsSaving(true);
		setError(null);
		setInfoMessage(null);

		try {
			const nextTag = {
				...selectedTag,
				color,
				name: trimmedName,
				updatedAt: new Date().toISOString(),
			};

			setTags((currentTags) =>
				currentTags.map((tag) => (tag.id === nextTag.id ? nextTag : tag)),
			);
			setSelectedTag(nextTag);
			setName(nextTag.name);
			setColor(nextTag.color);
			updateTagInDiaryCache(selectedBaby.id, nextTag);
			await upsertPendingTag(session.user.id, selectedBaby.id, nextTag);

			if (connectionStatus !== "online") {
				await enqueueTagMutation({
					babyId: selectedBaby.id,
					id: createUuid(),
					operation: "update",
					payload: { color, name: trimmedName },
					status: "pending",
					tagId: selectedTag.id,
					userId: session.user.id,
				});
				setInfoMessage("Tag saved locally. It will sync when you're online.");
				return;
			}

			const response = await updateTag(selectedBaby.id, selectedTag.id, {
				color,
				name: trimmedName,
			});
			setTags((currentTags) =>
				currentTags.map((tag) => (tag.id === response.tag.id ? response.tag : tag)),
			);
			setSelectedTag(response.tag);
			setName(response.tag.name);
			setColor(response.tag.color);
			updateTagInDiaryCache(selectedBaby.id, response.tag);
			await saveTagsCache(session.user.id, selectedBaby.id, [
				...tags.filter((tag) => tag.id !== response.tag.id),
				response.tag,
			]);
			markOnline();
		} catch (caughtError) {
			setInfoMessage(null);
			setError(getErrorMessage(caughtError));
			markOffline();
		} finally {
			setIsSaving(false);
		}
	};

	const removeTag = async () => {
		if (!selectedBaby || !selectedTag || !session) {
			return;
		}

		setIsSaving(true);
		setError(null);
		setInfoMessage(null);

		try {
			setTags((currentTags) => currentTags.filter((tag) => tag.id !== selectedTag.id));
			removeTagFromDiaryCache(selectedBaby.id, selectedTag.id);
			await markTagDeleted(session.user.id, selectedBaby.id, selectedTag.id);

			if (connectionStatus !== "online") {
				await enqueueTagMutation({
					babyId: selectedBaby.id,
					id: createUuid(),
					operation: "delete",
					payload: {},
					status: "pending",
					tagId: selectedTag.id,
					userId: session.user.id,
				});
				setSelectedTag(null);
				setIsDeleteModalVisible(false);
				setInfoMessage("Tag removed locally. It will sync when you're online.");
				return;
			}

			await deleteTag(selectedBaby.id, selectedTag.id);
			setSelectedTag(null);
			setIsDeleteModalVisible(false);
			markOnline();
		} catch (caughtError) {
			setInfoMessage(null);
			setError(getErrorMessage(caughtError));
			markOffline();
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Milestone Tags" />
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						onRefresh={() => void load({ forceNetwork: true })}
						refreshing={isLoading}
						tintColor={themeColors.primary}
					/>
				}
			>
				{!selectedBaby ? (
					<View style={globalStyles.card}>
						<Text style={globalStyles.bodyText}>Select a baby to manage tags.</Text>
					</View>
				) : null}

				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Custom Tags</Text>
					<Text style={styles.helper}>Tap a custom tag to edit its name or color.</Text>
					<View style={styles.tagWrap}>
						{customTags.map((tag) => (
							<Pressable key={tag.id} onPress={() => selectTag(tag)} style={styles.tagButton}>
								<DiaryTagPill tag={tag} />
							</Pressable>
						))}
						{customTags.length === 0 ? (
							<Text style={styles.helper}>No custom tags yet. Create tags from a diary entry.</Text>
						) : null}
					</View>
				</View>

				{selectedTag ? (
					<View style={globalStyles.card}>
						<View style={globalStyles.rowBetween}>
							<Text style={styles.sectionTitle}>Edit Custom Tag</Text>
							<Pressable onPress={() => setSelectedTag(null)} style={styles.iconButton}>
								<Ionicons color={themeColors.textSecondary} name="close" size={20} />
							</Pressable>
						</View>
						<View style={styles.previewRow}>
							<Text style={styles.helper}>Preview</Text>
							{previewTag ? <DiaryTagPill tag={previewTag} /> : null}
						</View>
						<Text style={styles.label}>Name</Text>
						<TextInput
							autoCapitalize="words"
							maxLength={40}
							onChangeText={setName}
							placeholder="Tag name"
							placeholderTextColor={themeColors.textSecondary}
							style={styles.input}
							value={name}
						/>
						<Text style={styles.label}>Color</Text>
						<View style={styles.swatchRow}>
							{TAG_COLORS.map((tagColor) => (
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ selected: color === tagColor }}
									key={tagColor}
									onPress={() => setColor(tagColor)}
									style={[
										styles.swatch,
										{ backgroundColor: tagColor },
										color === tagColor && styles.swatchSelected,
									]}
								/>
							))}
						</View>
						<View style={styles.actionRow}>
							<Pressable
								disabled={isSaving}
								onPress={() => setIsDeleteModalVisible(true)}
								style={[styles.actionButton, styles.deleteButton]}
							>
								<Text style={styles.deleteText}>Remove</Text>
							</Pressable>
							<Pressable
								disabled={isSaving}
								onPress={() => void saveTag()}
								style={[styles.actionButton, styles.saveButton, isSaving && styles.disabled]}
							>
								<Text style={styles.saveText}>{isSaving ? "Saving..." : "Save"}</Text>
							</Pressable>
						</View>
					</View>
				) : null}

				{infoMessage ? (
					<View style={styles.infoBanner}>
						<Ionicons color="#2563EB" name="information-circle-outline" size={18} />
						<Text style={styles.infoText}>{infoMessage}</Text>
					</View>
				) : null}
				{error ? <Text style={styles.errorText}>{error}</Text> : null}

				<View style={globalStyles.card}>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ expanded: areDefaultTagsExpanded }}
						onPress={() => setAreDefaultTagsExpanded((currentValue) => !currentValue)}
						style={styles.defaultHeader}
					>
						<View>
							<Text style={styles.sectionTitle}>Default Tags</Text>
							<Text style={styles.helper}>Common tags provided for ease of access.</Text>
						</View>
						<Ionicons
							color={themeColors.textSecondary}
							name={areDefaultTagsExpanded ? "chevron-up" : "chevron-down"}
							size={22}
						/>
					</Pressable>
					{areDefaultTagsExpanded ? (
						<View style={styles.defaultGroups}>
							{globalTagsByType.map((group) => (
								<View key={group.type} style={styles.defaultGroup}>
									<Text style={styles.typeLabel}>{formatTagType(group.type)}</Text>
									<View style={styles.tagWrap}>
										{group.tags.map((tag) => (
											<DiaryTagPill tag={tag} key={tag.id}/>
										))}
									</View>
								</View>
							))}
						</View>
					) : null}
				</View>
			</ScrollView>
			<ConfirmDeleteModal
				confirmLabel="Remove"
				message="This removes the custom tag and detaches it from diary entries. Default tags cannot be removed."
				onCancel={() => setIsDeleteModalVisible(false)}
				onConfirm={() => void removeTag()}
				title="Remove tag?"
				visible={isDeleteModalVisible}
			/>
		</SafeAreaView>
	);
}

function sortTags(left: DiaryTag, right: DiaryTag) {
	return left.name.localeCompare(right.name);
}

function groupTagsByType(tags: DiaryTag[]) {
	const typeToTags = new Map<string, DiaryTag[]>();

	for (const tag of tags) {
		const normalizedType = tag.type.trim().toLowerCase() || "other";
		typeToTags.set(normalizedType, [...(typeToTags.get(normalizedType) ?? []), tag]);
	}

	const orderedTypes = [
		...DEFAULT_TAG_TYPE_ORDER.filter((type) => typeToTags.has(type)),
		...Array.from(typeToTags.keys())
			.filter((type) => !DEFAULT_TAG_TYPE_ORDER.includes(type))
			.sort(),
	];

	return orderedTypes.map((type) => ({
		tags: (typeToTags.get(type) ?? []).sort(sortTags),
		type,
	}));
}

function formatTagType(type: string) {
	if (type === "emotions") {
		return "Emotions";
	}

	return type
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function createUuid() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
		const random = Math.floor(Math.random() * 16);
		const next = value === "x" ? random : (random & 0x3) | 0x8;
		return next.toString(16);
	});
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not update tags. Please try again.";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	actionButton: {
		alignItems: "center",
		borderRadius: 12,
		flex: 1,
		paddingVertical: spacing.md,
	},
	actionRow: {
		flexDirection: "row",
		gap: spacing.md,
		marginTop: spacing.md,
	},
	content: {
		gap: spacing.md,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	defaultGroup: {
		gap: spacing.sm,
	},
	defaultGroups: {
		gap: spacing.md,
		marginTop: spacing.md,
	},
	defaultHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		justifyContent: "space-between",
	},
	deleteButton: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.error,
		borderWidth: 1,
	},
	deleteText: {
		...typography.label,
		color: themeColors.error,
	},
	disabled: {
		opacity: 0.5,
	},
	errorText: {
		...typography.caption,
		color: themeColors.error,
	},
	helper: {
		...typography.caption,
		color: themeColors.textSecondary,
		lineHeight: 18,
		marginTop: spacing.xs,
	},
	iconButton: {
		padding: spacing.xs,
	},
	infoBanner: {
		alignItems: "center",
		backgroundColor: "#EAF4FF",
		borderColor: "#B9DCF8",
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	infoText: {
		...typography.caption,
		color: "#2563EB",
		flex: 1,
		lineHeight: 18,
	},
	input: {
		...typography.body,
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		color: themeColors.textPrimary,
		marginTop: spacing.xs,
		padding: spacing.md,
	},
	label: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: spacing.md,
		textTransform: "uppercase",
	},
	previewRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	saveButton: {
		backgroundColor: themeColors.primary,
	},
	saveText: {
		...typography.label,
		color: themeColors.surface,
	},
	sectionTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	swatch: {
		borderColor: themeColors.surface,
		borderRadius: 999,
		borderWidth: 3,
		height: 34,
		width: 34,
	},
	swatchRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	swatchSelected: {
		borderColor: themeColors.textPrimary,
	},
	tagButton: {
		alignSelf: "flex-start",
	},
	tagWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	typeLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
		fontWeight: "800",
		textTransform: "uppercase",
	},
});
}
