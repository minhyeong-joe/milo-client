import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import { DiaryActionsModal } from "@/components/diary/DiaryActionsModal";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import { useSync } from "@/context/SyncContext";
import {
	deleteDiaryEntry,
	listDiaryEntries,
	type DiaryEntry,
} from "@/services/api/diary";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 10;

export default function DiaryScreen() {
	const router = useRouter();
	const { selectedBaby } = useBabySelection();
	const { connectionStatus, markOffline, markOnline } = useSync();
	const {
		appendDiaryPage,
		getDiaryCache,
		removeDiaryEntryFromCache,
		setDiaryFirstPage,
		shouldRefreshDiaryCache,
	} = useDiaryCache();
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [actionEntry, setActionEntry] = useState<DiaryEntry | null>(null);
	const [deleteEntry, setDeleteEntry] = useState<DiaryEntry | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const diaryCache = selectedBaby ? getDiaryCache(selectedBaby.id) : null;
	const entries = diaryCache?.entries ?? [];
	const nextCursor = diaryCache?.nextCursor ?? null;
	const isDiaryOffline = connectionStatus !== "online";

	const todayDate = useMemo(
		() => getDateKeyInTimeZone(new Date(), selectedBaby?.timezone),
		[selectedBaby?.timezone],
	);

	const loadFirstPage = useCallback(
		async ({
			forceNetwork = false,
			refreshing = false,
		}: { forceNetwork?: boolean; refreshing?: boolean } = {}) => {
			if (!selectedBaby) {
				setError(null);
				return;
			}

			if (connectionStatus !== "online" && !forceNetwork) {
				setError(DIARY_OFFLINE_MESSAGE);
				return;
			}

			if (refreshing) {
				setIsRefreshing(true);
			} else {
				setIsLoading(true);
			}
			setError(null);

			try {
				const response = await listDiaryEntries({
					babyId: selectedBaby.id,
					endDate: getDateKeyInTimeZone(new Date(), selectedBaby.timezone),
					take: PAGE_SIZE,
				});
				setDiaryFirstPage(selectedBaby.id, response);
				markOnline();
			} catch {
				markOffline();
				setError(DIARY_OFFLINE_MESSAGE);
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		},
		[connectionStatus, markOffline, markOnline, selectedBaby, setDiaryFirstPage],
	);

	const loadMore = useCallback(async () => {
		if (!selectedBaby || !nextCursor || isLoadingMore || isLoading || isDiaryOffline) {
			return;
		}

		setIsLoadingMore(true);
		try {
			const response = await listDiaryEntries({
				babyId: selectedBaby.id,
				cursor: nextCursor,
				take: PAGE_SIZE,
			});
			appendDiaryPage(selectedBaby.id, response);
			markOnline();
		} catch (caughtError) {
			console.warn(caughtError);
			markOffline();
		} finally {
			setIsLoadingMore(false);
		}
	}, [appendDiaryPage, isDiaryOffline, isLoading, isLoadingMore, markOffline, markOnline, nextCursor, selectedBaby]);

	useFocusEffect(
		useCallback(() => {
			if (!selectedBaby || !shouldRefreshDiaryCache(selectedBaby.id)) {
				return;
			}

			void loadFirstPage();
		}, [loadFirstPage, selectedBaby, shouldRefreshDiaryCache]),
	);

	const openEntry = (entry: DiaryEntry) => {
		router.push({
			pathname: "/diary/[diaryId]",
			params: {
				diaryId: entry.id,
				entry: encodeURIComponent(JSON.stringify(entry)),
			},
		});
	};

	const showDiaryOfflineAlert = (message: string) => {
		setError(message);
		Alert.alert("Diary unavailable offline", message);
	};

	const openAdd = () => {
		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_ADD_OFFLINE_MESSAGE);
			return;
		}

		router.push("/diary/add");
	};

	const openEdit = (entry: DiaryEntry) => {
		setActionEntry(null);

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

	const requestDelete = (entry: DiaryEntry) => {
		setActionEntry(null);

		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_DELETE_OFFLINE_MESSAGE);
			return;
		}

		setDeleteEntry(entry);
	};

	const confirmDelete = async () => {
		if (!selectedBaby || !deleteEntry) {
			return;
		}

		if (isDiaryOffline) {
			showDiaryOfflineAlert(DIARY_DELETE_OFFLINE_MESSAGE);
			setDeleteEntry(null);
			return;
		}

		setIsDeleting(true);

		try {
			await deleteDiaryEntry(selectedBaby.id, deleteEntry.id);
			removeDiaryEntryFromCache(selectedBaby.id, deleteEntry.id);
			setDeleteEntry(null);
		} catch (caughtError) {
			console.warn(caughtError);
			setError("Could not delete diary entry. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<View style={styles.header}>
					<Text style={globalStyles.titleText}>Diary</Text>
					<View style={styles.headerActions}>
						<HeaderIconButton
							label="Search diary"
							name="search-outline"
							onPress={() => undefined}
						/>
						<HeaderIconButton
							label="Filter diary"
							name="filter-outline"
							onPress={() => undefined}
						/>
						<Pressable
							accessibilityLabel="Add diary entry"
							accessibilityState={{ disabled: isDiaryOffline }}
							onPress={openAdd}
							style={[
								styles.addButton,
								isDiaryOffline && styles.disabledAddButton,
							]}
						>
							<Ionicons color={colors.light.surface} name="add" size={24} />
						</Pressable>
					</View>
				</View>

				{selectedBaby && isDiaryOffline ? (
					<ScrollView
						contentContainerStyle={styles.offlineScrollContent}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								tintColor={colors.light.primary}
								onRefresh={() =>
									loadFirstPage({ forceNetwork: true, refreshing: true })
								}
							/>
						}
					>
						<DiaryOfflineState
							isRetrying={isRefreshing}
							onRetry={() =>
								loadFirstPage({ forceNetwork: true, refreshing: true })
							}
						/>
					</ScrollView>
				) : selectedBaby ? (
					<FlatList
						contentContainerStyle={[
							styles.listContent,
							entries.length === 0 && styles.emptyListContent,
						]}
						data={entries}
						keyExtractor={(entry) => entry.id}
						ListEmptyComponent={
							isLoading ? (
								<View style={styles.centerState}>
									<ActivityIndicator color={colors.light.primary} />
								</View>
							) : (
								<DiaryEmptyState error={error} onRetry={() => loadFirstPage()} />
							)
						}
						ListFooterComponent={
							isLoadingMore ? (
								<View style={styles.footerLoader}>
									<ActivityIndicator color={colors.light.primary} />
								</View>
							) : null
						}
						onEndReached={loadMore}
						onEndReachedThreshold={0.35}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								tintColor={colors.light.primary}
								onRefresh={() =>
									loadFirstPage({ forceNetwork: true, refreshing: true })
								}
							/>
						}
						renderItem={({ item }) => (
							<DiaryEntryCard
								entry={item}
								onMorePress={setActionEntry}
								onPress={openEntry}
								todayDate={todayDate}
							/>
						)}
						showsVerticalScrollIndicator={false}
					/>
				) : (
					<View style={[globalStyles.card, styles.noBabyCard]}>
						<Text style={globalStyles.sectionTitleText}>No baby selected</Text>
						<Text style={globalStyles.bodyText}>
							Choose a baby on Home before viewing diary entries.
						</Text>
					</View>
				)}
			</View>
			<DiaryActionsModal
				onClose={() => setActionEntry(null)}
				onDelete={() => actionEntry && requestDelete(actionEntry)}
				onEdit={() => actionEntry && openEdit(actionEntry)}
				visible={Boolean(actionEntry)}
			/>
			<ConfirmDeleteModal
				confirmLabel={isDeleting ? "Deleting..." : "Delete"}
				message="Are you sure you want to delete this diary entry permanently?"
				onCancel={() => setDeleteEntry(null)}
				onConfirm={() => void confirmDelete()}
				title="Delete diary entry?"
				visible={Boolean(deleteEntry)}
			/>
		</SafeAreaView>
	);
}

const DIARY_OFFLINE_MESSAGE =
	"Diary is unavailable offline.";
const DIARY_ADD_OFFLINE_MESSAGE =
	"Diary is unavailable offline.";
const DIARY_EDIT_OFFLINE_MESSAGE =
	"Reconnect to edit diary entries.";
const DIARY_DELETE_OFFLINE_MESSAGE =
	"Reconnect to delete diary entries.";

function DiaryOfflineState({
	isRetrying,
	onRetry,
}: {
	isRetrying: boolean;
	onRetry: () => void;
}) {
	return (
		<View style={styles.centerState}>
			<Ionicons color={colors.light.textSecondary} name="cloud-offline-outline" size={32} />
			<Text style={styles.emptyTitle}>{DIARY_OFFLINE_MESSAGE}</Text>
			<Pressable
				accessibilityRole="button"
				disabled={isRetrying}
				onPress={onRetry}
				style={[styles.retryButton, isRetrying && styles.disabledRetryButton]}
			>
				<Text style={styles.retryText}>{isRetrying ? "Trying..." : "Try Again"}</Text>
			</Pressable>
		</View>
	);
}

function HeaderIconButton({
	label,
	name,
	onPress,
}: {
	label: string;
	name: keyof typeof Ionicons.glyphMap;
	onPress: () => void;
}) {
	return (
		<Pressable accessibilityLabel={label} onPress={onPress} style={styles.headerIconButton}>
			<Ionicons color={colors.light.textPrimary} name={name} size={22} />
		</Pressable>
	);
}

function DiaryEmptyState({
	error,
	onRetry,
}: {
	error: string | null;
	onRetry: () => void;
}) {
	return (
		<View style={styles.centerState}>
			<Ionicons color={colors.light.textSecondary} name="journal-outline" size={32} />
			<Text style={styles.emptyTitle}>{error ? "Diary unavailable" : "No diary entries yet"}</Text>
			<Text style={styles.emptyText}>
				{error ?? "Capture a small moment, milestone, or memory when you are ready."}
			</Text>
			{error ? (
				<Pressable onPress={onRetry} style={styles.retryButton}>
					<Text style={styles.retryText}>Try Again</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function getDateKeyInTimeZone(value: Date, timeZone?: string | null) {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone: timeZone || undefined,
		year: "numeric",
	});
	const parts = formatter.formatToParts(value);
	const year = parts.find((part) => part.type === "year")?.value ?? String(value.getFullYear());
	const month =
		parts.find((part) => part.type === "month")?.value ??
		String(value.getMonth() + 1).padStart(2, "0");
	const day =
		parts.find((part) => part.type === "day")?.value ??
		String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
	addButton: {
		alignItems: "center",
		backgroundColor: colors.light.primary,
		borderRadius: 999,
		height: 42,
		justifyContent: "center",
		width: 42,
	},
	centerState: {
		alignItems: "center",
		gap: spacing.sm,
		padding: spacing.xl,
	},
	disabledAddButton: {
		backgroundColor: colors.light.textSecondary,
		opacity: 0.65,
	},
	disabledRetryButton: {
		opacity: 0.65,
	},
	emptyListContent: {
		flexGrow: 1,
		justifyContent: "center",
	},
	emptyText: {
		...typography.body,
		color: colors.light.textSecondary,
		textAlign: "center",
	},
	emptyTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
		textAlign: "center",
	},
	footerLoader: {
		paddingVertical: spacing.lg,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: spacing.md,
	},
	headerActions: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	headerIconButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 999,
		borderWidth: 1,
		height: 42,
		justifyContent: "center",
		width: 42,
	},
	listContent: {
		gap: spacing.md,
		paddingBottom: spacing.md,
	},
	noBabyCard: {
		gap: spacing.sm,
	},
	offlineScrollContent: {
		flexGrow: 1,
		justifyContent: "center",
	},
	retryButton: {
		backgroundColor: colors.light.primary,
		borderRadius: 999,
		marginTop: spacing.sm,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	retryText: {
		...typography.caption,
		color: colors.light.surface,
	},
});
