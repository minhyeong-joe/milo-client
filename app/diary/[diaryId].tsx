import { DiaryActionsModal } from "@/components/diary/DiaryActionsModal";
import { DiaryHeroCarousel } from "@/components/diary/DiaryMediaPreview";
import { DiaryReflectionCard } from "@/components/diary/DiaryReflectionCard";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useAppPreferences, useTimelineTimeZone , useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import { useSync } from "@/context/SyncContext";
import { deleteDiaryEntry, type DiaryEntry } from "@/services/api/diary";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { formatBabyAge } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { usePreventRemove } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useMemo } from "react";
import { Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function DiaryDetailScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	const params = useLocalSearchParams<{ diaryId: string; entry?: string }>();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const { getDiaryCache, removeDiaryEntryFromCache } = useDiaryCache();
	const { connectionStatus } = useSync();
	const parsedEntry = parseEntryParam(params.entry);
	const cachedEntry = selectedBaby
		? getDiaryCache(selectedBaby.id).entries.find((item) => item.id === params.diaryId)
		: null;
	const entry = cachedEntry ?? parsedEntry;
	const [isActionsVisible, setIsActionsVisible] = useState(false);
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isMetadataVisible, setIsMetadataVisible] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isAiReflectionBusy, setIsAiReflectionBusy] = useState(false);
	const insets = useSafeAreaInsets();
	const footerBottomPadding = Math.max(insets.bottom, 12);
	const isDiaryOffline = connectionStatus !== "online";
	const handleAiBusyChange = useCallback((isBusy: boolean) => {
		setIsAiReflectionBusy(isBusy);
	}, []);

	usePreventRemove(isAiReflectionBusy, () => {});

	useEffect(() => {
		if (!isAiReflectionBusy) {
			return;
		}

		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => true,
		);

		return () => subscription.remove();
	}, [isAiReflectionBusy]);

	const goBack = () => {
		if (isAiReflectionBusy) {
			return;
		}

		router.back();
	};

	const openEdit = () => {
		if (isAiReflectionBusy) {
			return;
		}

		if (!entry) {
			return;
		}

		setIsActionsVisible(false);

		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_EDIT_OFFLINE_MESSAGE);
			return;
		}

		router.push({
			pathname: "/diary/edit",
			params: {
				entry: encodeURIComponent(JSON.stringify(entry)),
			},
		});
	};

	const requestDelete = () => {
		if (isAiReflectionBusy) {
			return;
		}

		setIsActionsVisible(false);

		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_DELETE_OFFLINE_MESSAGE);
			return;
		}

		setIsDeleteModalVisible(true);
	};

	const confirmDelete = async () => {
		if (!selectedBaby || !entry) {
			return;
		}

		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_DELETE_OFFLINE_MESSAGE);
			setIsDeleteModalVisible(false);
			return;
		}

		setIsDeleting(true);

		try {
			await deleteDiaryEntry(selectedBaby.id, entry.id);
			removeDiaryEntryFromCache(selectedBaby.id, entry.id);
			setIsDeleteModalVisible(false);
			router.replace("/(tabs)/diary");
		} catch (error) {
			console.warn(error);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={{...globalStyles.screen, paddingBottom: footerBottomPadding}}>
			<View style={styles.header}>
				<Pressable
					accessibilityLabel="Go back"
					disabled={isAiReflectionBusy}
					hitSlop={10}
					onPress={goBack}
					style={[styles.iconButton, isAiReflectionBusy && styles.disabledControl]}
				>
					<Ionicons color={themeColors.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={!entry || isAiReflectionBusy}
					onPress={() => setIsMetadataVisible(true)}
					style={[styles.dateButton, isAiReflectionBusy && styles.disabledControl]}
				>
					<Text style={styles.headerTitle}>
						{entry ? formatHeaderDate(entry.diaryDate, timelineTimeZone, languagePreference) : "Diary"}
					</Text>
					{entry ? (
						<Text style={styles.headerSubtitle}>
							{formatHeaderSubtitle(entry.diaryDate, selectedBaby?.birthdate, timelineTimeZone, languagePreference)}
						</Text>
					) : null}
				</Pressable>
				<Pressable
					accessibilityLabel="Diary actions"
					disabled={isAiReflectionBusy}
					hitSlop={10}
					onPress={() => setIsActionsVisible(true)}
					style={[styles.iconButton, isAiReflectionBusy && styles.disabledControl]}
				>
					<Ionicons color={themeColors.textSecondary} name="ellipsis-horizontal" size={22} />
				</Pressable>
			</View>

			<ScrollView contentContainerStyle={[globalStyles.scrollContent, styles.content]}>
				{entry ? (
					<>
						{entry.media.length > 0 ? (
							<DiaryHeroCarousel media={entry.media} />
						) : null}
						<View style={[globalStyles.card, globalStyles.shadowCard, styles.storyCard]}>
							
							<View style={styles.storyHeaderRow}>
								<View style={styles.quoteBadge}>
									<Text style={styles.quoteText}>“</Text>
								</View>
								<View style={styles.storyHeaderText}>
									{entry.title?.trim() ? (
										<Text style={styles.storyTitle}>{entry.title.trim()}</Text>
									) : null}
									<Text style={styles.contentText}>{entry.content}</Text>
								</View>
							</View>
						</View>
						{entry.tags.length > 0 ? (
										<View style={styles.tagRow}>
											{entry.tags.map((tag) => (
												<DiaryTagPill key={tag.id} tag={tag} />
											))}
										</View>
									) : null}
						{selectedBaby ? (
							<DiaryReflectionCard
								babyId={selectedBaby.id}
								diaryId={entry.id}
								isOnline={!isDiaryOffline}
								language={languagePreference}
								onBusyChange={handleAiBusyChange}
								timeZone={timelineTimeZone}
							/>
						) : null}
					</>
				) : (
					<View style={globalStyles.card}>
						<Text style={globalStyles.sectionTitleText}>Entry not loaded</Text>
						<Text style={globalStyles.bodyText}>
							Go back to Diary and open this entry again.
						</Text>
					</View>
				)}
			</ScrollView>
			<DiaryActionsModal
				onClose={() => setIsActionsVisible(false)}
				onDelete={requestDelete}
				onEdit={openEdit}
				visible={Boolean(entry) && isActionsVisible}
			/>
			<ConfirmDeleteModal
				confirmLabel={isDeleting ? "Deleting..." : "Delete"}
				message="Are you sure you want to delete this diary entry permanently?"
				onCancel={() => setIsDeleteModalVisible(false)}
				onConfirm={() => void confirmDelete()}
				title="Delete diary entry?"
				visible={Boolean(entry) && isDeleteModalVisible}
			/>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsMetadataVisible(false)}
				transparent
				visible={Boolean(entry) && isMetadataVisible}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setIsMetadataVisible(false)}
					style={styles.metadataBackdrop}
				>
					<Pressable style={styles.metadataPopover}>
						<Text style={globalStyles.sectionTitleText}>Entry history</Text>
						{entry ? (
							<>
								<MetadataRow label="Created by" value={formatUser(entry.createdBy, entry.createdById)} />
								<MetadataRow label="Created at" value={formatDateTime(entry.createdAt, timelineTimeZone, languagePreference)} />
								<MetadataRow label="Modified by" value={formatUser(entry.updatedBy, entry.updatedById)} />
								<MetadataRow label="Modified at" value={formatDateTime(entry.updatedAt, timelineTimeZone, languagePreference)} />
							</>
						) : null}
					</Pressable>
				</Pressable>
			</Modal>
		</SafeAreaView>
	);
}

const DIARY_EDIT_OFFLINE_MESSAGE =
	"Reconnect to edit diary entries. Diary media requires an internet connection.";
const DIARY_DELETE_OFFLINE_MESSAGE =
	"Reconnect to delete diary entries. Diary media requires an internet connection.";

function showDiaryOfflineAlert(message: string) {
	Alert.alert("Diary unavailable offline", message);
}

function MetadataRow({ label, value }: { label: string; value: string }) {
	const { styles } = useThemeStyles();
	return (
		<View style={styles.metadataRow}>
			<Text style={styles.metadataLabel}>{label}</Text>
			<Text numberOfLines={1} style={styles.metadataValue}>
				{value}
			</Text>
		</View>
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

function formatDateTime(value: string, timeZone?: string, locale = "en-US") {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone,
		timeStyle: "short",
	}).format(date);
}

function formatHeaderDate(dateKey: string, timeZone?: string, locale = "en-US") {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		timeZone,
		year: "numeric",
	}).format(date);
}

function formatHeaderSubtitle(dateKey: string, birthdate?: string, timeZone?: string, locale = "en-US") {
	const [year, month, day] = dateKey.split("-").map(Number);
	const entryDate = new Date(year, month - 1, day);
	const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(entryDate);
	const ageLabel = birthdate ? formatBabyAge(birthdate, entryDate) : null;

	return ageLabel ? `${weekday} · ${ageLabel} old` : weekday;
}

function formatUser(
	user: DiaryEntry["createdBy"] | DiaryEntry["updatedBy"] | undefined,
	fallbackId: string,
) {
	if (user?.displayName) {
		return user.displayName;
	}

	if (user?.email) {
		return user.email;
	}

	return fallbackId;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	contentText: {
		...typography.body,
		color: themeColors.textPrimary,
		fontSize: 16,
		lineHeight: 24,
	},
	dateText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	dateButton: {
		alignItems: "center",
		flex: 1,
		gap: spacing.xs,
		justifyContent: "center",
		minWidth: 0,
	},
	disabledControl: {
		opacity: 0.45,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	headerTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
		flexShrink: 1,
		textAlign: "center",
	},
	headerSubtitle: {
		...typography.caption,
		color: themeColors.textSecondary,
		textAlign: "center",
	},
	iconButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	metadataBackdrop: {
		alignItems: "center",
		backgroundColor: themeColors.backdrop,
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	metadataLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	metadataRow: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
	},
	metadataValue: {
		...typography.caption,
		color: themeColors.textPrimary,
		flex: 1,
		textAlign: "right",
	},
	metadataPopover: {
		backgroundColor: themeColors.surface,
		borderRadius: 18,
		gap: spacing.sm,
		padding: spacing.lg,
		width: "100%",
	},
	sectionLabel: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	quoteBadge: {
		alignItems: "center",
		backgroundColor: themeColors.tintSurfaceStrong,
		borderRadius: 999,
		height: 40,
		justifyContent: "center",
		width: 40,
	},
	quoteText: {
		color: themeColors.primary,
		fontSize: 34,
		fontWeight: "800",
		lineHeight: 50,
	},
	storyCard: {
		gap: spacing.md,
		marginTop: spacing.md,
	},
	storyHeaderRow: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: spacing.md,
	},
	storyHeaderText: {
		flex: 1,
		gap: spacing.sm,
	},
	storyTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
		fontSize: 22,
		lineHeight: 28,
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
});
}
