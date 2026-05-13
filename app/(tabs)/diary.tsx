import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import { DiaryActionsModal } from "@/components/diary/DiaryActionsModal";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useBabySelection } from "@/context/BabySelectionContext";
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
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 10;

export default function DiaryScreen() {
	const router = useRouter();
	const { selectedBaby } = useBabySelection();
	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [actionEntry, setActionEntry] = useState<DiaryEntry | null>(null);
	const [deleteEntry, setDeleteEntry] = useState<DiaryEntry | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const todayDate = useMemo(
		() => getDateKeyInTimeZone(new Date(), selectedBaby?.timezone),
		[selectedBaby?.timezone],
	);

	const loadFirstPage = useCallback(
		async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
			if (!selectedBaby) {
				setEntries([]);
				setNextCursor(null);
				setError(null);
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
				setEntries(response.diaryEntries);
				setNextCursor(response.nextCursor);
			} catch {
				setError("Could not load diary entries. Pull to refresh or try again.");
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		},
		[selectedBaby],
	);

	const loadMore = useCallback(async () => {
		if (!selectedBaby || !nextCursor || isLoadingMore || isLoading) {
			return;
		}

		setIsLoadingMore(true);
		try {
			const response = await listDiaryEntries({
				babyId: selectedBaby.id,
				cursor: nextCursor,
				take: PAGE_SIZE,
			});
			setEntries((currentEntries) => mergeEntries(currentEntries, response.diaryEntries));
			setNextCursor(response.nextCursor);
		} catch (caughtError) {
			console.warn(caughtError);
		} finally {
			setIsLoadingMore(false);
		}
	}, [isLoading, isLoadingMore, nextCursor, selectedBaby]);

	useFocusEffect(
		useCallback(() => {
			void loadFirstPage();
		}, [loadFirstPage]),
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

	const openEdit = (entry: DiaryEntry) => {
		setActionEntry(null);
		router.push({
			pathname: "/diary/edit",
			params: {
				entry: encodeURIComponent(JSON.stringify(entry)),
			},
		});
	};

	const requestDelete = (entry: DiaryEntry) => {
		setActionEntry(null);
		setDeleteEntry(entry);
	};

	const confirmDelete = async () => {
		if (!selectedBaby || !deleteEntry) {
			return;
		}

		setIsDeleting(true);

		try {
			await deleteDiaryEntry(selectedBaby.id, deleteEntry.id);
			setEntries((currentEntries) =>
				currentEntries.filter((entry) => entry.id !== deleteEntry.id),
			);
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
							onPress={() => router.push("/diary/add")}
							style={styles.addButton}
						>
							<Ionicons color={colors.light.surface} name="add" size={24} />
						</Pressable>
					</View>
				</View>

				{selectedBaby ? (
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
								onRefresh={() => loadFirstPage({ refreshing: true })}
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

function mergeEntries(currentEntries: DiaryEntry[], nextEntries: DiaryEntry[]) {
	const seenIds = new Set(currentEntries.map((entry) => entry.id));
	const mergedEntries = [...currentEntries];

	for (const entry of nextEntries) {
		if (!seenIds.has(entry.id)) {
			seenIds.add(entry.id);
			mergedEntries.push(entry);
		}
	}

	return mergedEntries;
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
