import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import { DiaryActionsModal } from "@/components/diary/DiaryActionsModal";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useAppPreferences, useTimelineTimeZone , useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useDiaryCache } from "@/context/DiaryCacheContext";
import { useSync } from "@/context/SyncContext";
import {
	deleteDiaryEntry,
	listDiaryEntries,
	type DiaryEntry,
	type DiaryListFilters,
	type DiaryTag,
} from "@/services/api/diary";
import { listTags } from "@/services/api/tags";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	Keyboard
} from "react-native";
import { SafeAreaView , useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const TAG_TYPE_FILTERS = [
	{ color: "#F59E0B", label: "Milestone", value: "milestone" },
	{ color: "#EC4899", label: "Emotions", value: "emotion" },
	{ color: "#38BDF8", label: "Events", value: "event" },
	{ color: "#64748B", label: "Custom", value: "custom" },
] as const;

type MediaFilter = "all" | "with" | "without";
type DiaryFilterState = {
	endDate: string | null;
	media: MediaFilter;
	startDate: string | null;
	tagIds: string[];
	tagTypes: string[];
};

const emptyFilters: DiaryFilterState = {
	endDate: null,
	media: "all",
	startDate: null,
	tagIds: [],
	tagTypes: [],
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function DiaryScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
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
	const [isSearchVisible, setIsSearchVisible] = useState(false);
	const searchBarRef = useRef<TextInput>(null);
	const [searchText, setSearchText] = useState("");
	const [debouncedSearchText, setDebouncedSearchText] = useState("");
	const [filters, setFilters] = useState<DiaryFilterState>(emptyFilters);
	const [draftFilters, setDraftFilters] = useState<DiaryFilterState>(emptyFilters);
	const [datePickerTarget, setDatePickerTarget] = useState<"start" | "end" | null>(null);
	const [isFilterVisible, setIsFilterVisible] = useState(false);
	const [availableTags, setAvailableTags] = useState<DiaryTag[]>([]);
	const [isLoadingTags, setIsLoadingTags] = useState(false);
	const activeDiaryFilters = useMemo(
		() => toDiaryListFilters(debouncedSearchText, filters),
		[debouncedSearchText, filters],
	);
	const diaryCacheKey = useMemo(
		() => serializeDiaryFilters(activeDiaryFilters),
		[activeDiaryFilters],
	);
	const diaryCache = selectedBaby ? getDiaryCache(selectedBaby.id, diaryCacheKey) : null;
	const entries = diaryCache?.entries ?? [];
	const nextCursor = diaryCache?.nextCursor ?? null;
	const isDiaryOffline = connectionStatus !== "online";
	const hasActiveFilters = diaryCacheKey !== DEFAULT_DIARY_FILTER_KEY;

	const todayDate = useMemo(
		() => getDateKeyInTimeZone(new Date(), selectedBaby?.timezone),
		[selectedBaby?.timezone],
	);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setDebouncedSearchText(searchText.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timeoutId);
	}, [searchText]);

	useEffect(() => {
		if (isSearchVisible) {
			requestAnimationFrame(() => {
				searchBarRef.current?.focus();
			});
		} else {
			searchBarRef.current?.blur();
			Keyboard.dismiss();
		}
	}, [isSearchVisible]);

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
					...activeDiaryFilters,
					endDate:
						activeDiaryFilters.endDate ??
						getDateKeyInTimeZone(new Date(), selectedBaby.timezone),
					take: PAGE_SIZE,
				});
				setDiaryFirstPage(selectedBaby.id, response, diaryCacheKey);
				markOnline();
			} catch {
				markOffline();
				setError(DIARY_OFFLINE_MESSAGE);
			} finally {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		},
		[
			activeDiaryFilters,
			connectionStatus,
			diaryCacheKey,
			markOffline,
			markOnline,
			selectedBaby,
			setDiaryFirstPage,
		],
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
				...activeDiaryFilters,
				take: PAGE_SIZE,
			});
			appendDiaryPage(selectedBaby.id, response, diaryCacheKey);
			markOnline();
		} catch (caughtError) {
			console.warn(caughtError);
			markOffline();
		} finally {
			setIsLoadingMore(false);
		}
	}, [
		activeDiaryFilters,
		appendDiaryPage,
		diaryCacheKey,
		isDiaryOffline,
		isLoading,
		isLoadingMore,
		markOffline,
		markOnline,
		nextCursor,
		selectedBaby,
	]);

	useFocusEffect(
		useCallback(() => {
			if (!selectedBaby || !shouldRefreshDiaryCache(selectedBaby.id, diaryCacheKey)) {
				return;
			}

			void loadFirstPage();
		}, [diaryCacheKey, loadFirstPage, selectedBaby, shouldRefreshDiaryCache]),
	);

	useEffect(() => {
		if (!selectedBaby || connectionStatus !== "online") {
			return;
		}

		void loadFirstPage();
	}, [connectionStatus, diaryCacheKey, loadFirstPage, selectedBaby]);

	const loadTags = useCallback(async () => {
		if (!selectedBaby || connectionStatus !== "online") {
			return;
		}

		setIsLoadingTags(true);

		try {
			const response = await listTags({ babyId: selectedBaby.id });
			setAvailableTags(response.tags);
			markOnline();
		} catch (caughtError) {
			console.warn(caughtError);
			markOffline();
		} finally {
			setIsLoadingTags(false);
		}
	}, [connectionStatus, markOffline, markOnline, selectedBaby]);

	const applyFilters = () => {
		setFilters(normalizeFilters(draftFilters));
		setIsFilterVisible(false);
		setDatePickerTarget(null);
	};

	const clearDraftFilters = () => {
		setDraftFilters(emptyFilters);
	};

	const handleFilterDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
		if (!datePickerTarget) {
			return;
		}

		if (selectedDate) {
			const nextDateKey = toDateKey(selectedDate);
			setDraftFilters((currentFilters) =>
				normalizeFilters({
					...currentFilters,
					[datePickerTarget === "start" ? "startDate" : "endDate"]: nextDateKey,
				}),
			);
		}

		setDatePickerTarget(null);
	};

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
							onPress={() => {
								setIsSearchVisible((currentValue) => !currentValue);
								setSearchText("");
							}}
						/>
						<HeaderIconButton
							label="Filter diary"
							name="filter-outline"
							onPress={() => {
								setDraftFilters(filters);
								setIsFilterVisible(true);
								void loadTags();
							}}
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
							<Ionicons color={themeColors.surface} name="add" size={24} />
						</Pressable>
					</View>
				</View>
				{isSearchVisible ? (
					<View style={styles.searchRow}>
						<Ionicons color={themeColors.textSecondary} name="search-outline" size={18} />
						<TextInput
							autoCapitalize="none"
							autoCorrect={false}
							onChangeText={setSearchText}
							placeholder="Search title or note"
							placeholderTextColor={themeColors.textSecondary}
							style={styles.searchInput}
							value={searchText}
							ref={searchBarRef}
						/>
						{searchText.length > 0 ? (
							<Pressable
								accessibilityLabel="Clear search"
								onPress={() => setSearchText("")}
								style={styles.clearIconButton}
							>
								<Ionicons color={themeColors.textSecondary} name="close-circle" size={18} />
							</Pressable>
						) : null}
					</View>
				) : null}
				<View>
					{hasActiveFilters ? (
						<ActiveFilterChips
							filters={activeDiaryFilters}
							locale={languagePreference}
							onClearAll={() => {
								setDebouncedSearchText("");
								setFilters(emptyFilters);
							}}
							onRemove={(key, value) => {
								setFilters((currentFilters) =>
									removeFilterValue(currentFilters, key, value),
								);
							}}
							timeZone={timelineTimeZone}
							tags={availableTags}
						/>
					) : null}
				</View>

				{selectedBaby && isDiaryOffline ? (
					<ScrollView
						contentContainerStyle={styles.offlineScrollContent}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								tintColor={themeColors.primary}
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
									<ActivityIndicator color={themeColors.primary} />
								</View>
							) : (
								<DiaryEmptyState error={error} onRetry={() => loadFirstPage()} />
							)
						}
						ListFooterComponent={
							isLoadingMore ? (
								<View style={styles.footerLoader}>
									<ActivityIndicator color={themeColors.primary} />
								</View>
							) : null
						}
						onEndReached={loadMore}
						onEndReachedThreshold={0.35}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								tintColor={themeColors.primary}
								onRefresh={() =>
									loadFirstPage({ forceNetwork: true, refreshing: true })
								}
							/>
						}
						renderItem={({ item }) => (
							<DiaryEntryCard
								entry={item}
								locale={languagePreference}
								onMorePress={setActionEntry}
								onPress={openEntry}
								timeZone={timelineTimeZone}
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
			<DiaryFilterModal
				availableTags={availableTags}
				datePickerTarget={datePickerTarget}
				draftFilters={draftFilters}
				isLoadingTags={isLoadingTags}
				onApply={applyFilters}
				onChangeDate={handleFilterDateChange}
				onClear={clearDraftFilters}
				onClose={() => {
					setIsFilterVisible(false);
					setDatePickerTarget(null);
				}}
				onDraftChange={setDraftFilters}
				onOpenDatePicker={setDatePickerTarget}
				locale={languagePreference}
				timeZone={timelineTimeZone}
				visible={isFilterVisible}
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

function ActiveFilterChips({
	filters,
	locale,
	onClearAll,
	onRemove,
	timeZone,
	tags,
}: {
	filters: DiaryListFilters;
	locale: string;
	onClearAll: () => void;
	onRemove: (key: ActiveFilterKey, value?: string) => void;
	timeZone?: string;
	tags: DiaryTag[];
}) {
	const { themeColors, styles } = useThemeStyles();
	const chips = getActiveFilterChips(filters, tags, timeZone, locale);

	if (chips.length === 0) {
		return null;
	}

	return (
		<ScrollView
			contentContainerStyle={styles.activeFilterRow}
			horizontal
			showsHorizontalScrollIndicator={false}
		>
			{chips.map((chip) => (
				<Pressable
					accessibilityRole="button"
					key={`${chip.key}:${chip.value ?? chip.label}`}
					onPress={() => onRemove(chip.key, chip.value)}
					style={styles.activeFilterChip}
				>
					<Text style={styles.activeFilterText}>{chip.label}</Text>
					<Ionicons color={themeColors.primary} name="close" size={14} />
				</Pressable>
			))}
			<Pressable accessibilityRole="button" onPress={onClearAll} style={styles.clearAllChip}>
				<Text style={styles.clearAllText}>Clear all</Text>
			</Pressable>
		</ScrollView>
	);
}

function DiaryFilterModal({
	availableTags,
	datePickerTarget,
	draftFilters,
	isLoadingTags,
	onApply,
	onChangeDate,
	onClear,
	onClose,
	onDraftChange,
	onOpenDatePicker,
	locale,
	timeZone,
	visible,
}: {
	availableTags: DiaryTag[];
	datePickerTarget: "start" | "end" | null;
	draftFilters: DiaryFilterState;
	isLoadingTags: boolean;
	onApply: () => void;
	onChangeDate: (event: DateTimePickerEvent, selectedDate?: Date) => void;
	onClear: () => void;
	onClose: () => void;
	onDraftChange: (filters: DiaryFilterState) => void;
	onOpenDatePicker: (target: "start" | "end") => void;
	locale: string;
	timeZone?: string;
	visible: boolean;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const sortedTags = useMemo(
		() => [...availableTags].sort((left, right) => left.name.localeCompare(right.name)),
		[availableTags],
	);
	const insets = useSafeAreaInsets();

	return (
		<Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
			<View style={{
					...styles.modalBackdrop, 
					paddingBottom: Math.max(insets.bottom, 12)
				}}
			>
				<View style={styles.filterSheet}>
					<View style={globalStyles.rowBetween}>
						<Text style={styles.filterTitle}>Filter diary</Text>
						<Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.clearIconButton}>
							<Ionicons color={themeColors.textSecondary} name="close" size={22} />
						</Pressable>
					</View>

					<ScrollView contentContainerStyle={styles.filterContent}>
						<Text style={styles.filterSectionTitle}>Date range</Text>
						<View style={styles.dateFilterRow}>
							<DateFilterButton
								label="From"
								locale={locale}
								onPress={() => onOpenDatePicker("start")}
								timeZone={timeZone}
								value={draftFilters.startDate}
							/>
							<DateFilterButton
								label="To"
								locale={locale}
								onPress={() => onOpenDatePicker("end")}
								timeZone={timeZone}
								value={draftFilters.endDate}
							/>
						</View>
						{datePickerTarget ? (
							<DateTimePicker
								maximumDate={new Date()}
								minimumDate={
									datePickerTarget === "end" && draftFilters.startDate
										? dateFromKey(draftFilters.startDate) ?? undefined
										: undefined
								}
								mode="date"
								onChange={onChangeDate}
								value={
									datePickerTarget === "start"
										? dateFromKey(draftFilters.startDate) ?? new Date()
										: dateFromKey(draftFilters.endDate) ?? new Date()
								}
							/>
						) : null}

						<Text style={styles.filterSectionTitle}>Media</Text>
						<View style={styles.segmentedRow}>
							{([
								["all", "All"],
								["with", "With media"],
								["without", "No media"],
							] as const).map(([value, label]) => (
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ selected: draftFilters.media === value }}
									key={value}
									onPress={() => onDraftChange({ ...draftFilters, media: value })}
									style={[
										styles.segmentButton,
										draftFilters.media === value && styles.segmentButtonActive,
									]}
								>
									<Text
										style={[
											styles.segmentText,
											draftFilters.media === value && styles.segmentTextActive,
										]}
									>
										{label}
									</Text>
								</Pressable>
							))}
						</View>

						<Text style={styles.filterSectionTitle}>Tag type</Text>
						<View style={styles.filterChipWrap}>
							{TAG_TYPE_FILTERS.map((filter) => {
								const isSelected = draftFilters.tagTypes.includes(filter.value);

								return (
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ selected: isSelected }}
										key={filter.value}
										onPress={() =>
											onDraftChange({
												...draftFilters,
												tagTypes: toggleArrayValue(draftFilters.tagTypes, filter.value),
											})
										}
										style={[
											styles.filterChip,
											{ borderColor: filter.color },
											isSelected && { backgroundColor: `${filter.color}1F` },
										]}
									>
										<Text style={[styles.filterChipText, { color: filter.color }]}>
											{filter.label}
										</Text>
									</Pressable>
								);
							})}
						</View>

						<View style={globalStyles.rowBetween}>
							<Text style={styles.filterSectionTitle}>Specific tags</Text>
							{isLoadingTags ? <Text style={styles.helperText}>Loading...</Text> : null}
						</View>
						<View style={styles.filterChipWrap}>
							{sortedTags.map((tag) => {
								const isSelected = draftFilters.tagIds.includes(tag.id);

								return (
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ selected: isSelected }}
										key={tag.id}
										onPress={() =>
											onDraftChange({
												...draftFilters,
												tagIds: toggleArrayValue(draftFilters.tagIds, tag.id),
											})
										}
										style={[styles.tagFilterPill, isSelected && styles.tagFilterPillActive]}
									>
										<DiaryTagPill tag={tag} />
									</Pressable>
								);
							})}
							{!isLoadingTags && sortedTags.length === 0 ? (
								<Text style={styles.helperText}>No tags available.</Text>
							) : null}
						</View>
					</ScrollView>

					<View style={styles.filterFooter}>
						<Pressable onPress={onClear} style={[styles.footerButton, styles.secondaryButton]}>
							<Text style={styles.secondaryButtonText}>Clear</Text>
						</Pressable>
						<Pressable onPress={onApply} style={[styles.footerButton, styles.primaryButton]}>
							<Text style={styles.primaryButtonText}>Apply</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function DateFilterButton({
	label,
	locale,
	onPress,
	timeZone,
	value,
}: {
	label: string;
	locale: string;
	onPress: () => void;
	timeZone?: string;
	value: string | null;
}) {
	const { styles } = useThemeStyles();
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.dateFilterButton}>
			<Text style={styles.helperText}>{label}</Text>
			<Text style={styles.dateFilterText}>
				{value ? formatShortDate(value, timeZone, locale) : "Any"}
			</Text>
		</Pressable>
	);
}

function DiaryOfflineState({
	isRetrying,
	onRetry,
}: {
	isRetrying: boolean;
	onRetry: () => void;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.centerState}>
			<Ionicons color={themeColors.textSecondary} name="cloud-offline-outline" size={32} />
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
	const { themeColors, styles } = useThemeStyles();
	return (
		<Pressable accessibilityLabel={label} onPress={onPress} style={styles.headerIconButton}>
			<Ionicons color={themeColors.textPrimary} name={name} size={22} />
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
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.centerState}>
			<Ionicons color={themeColors.textSecondary} name="journal-outline" size={32} />
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
	const formatter = new Intl.DateTimeFormat("en-US", {
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

type ActiveFilterKey =
	| "endDate"
	| "includeMedia"
	| "search"
	| "startDate"
	| "tagIds"
	| "tagTypes";

function toDiaryListFilters(search: string, filters: DiaryFilterState): DiaryListFilters {
	return {
		endDate: filters.endDate,
		includeMedia: filters.media === "all" ? null : filters.media === "with",
		search,
		startDate: filters.startDate,
		tagIds: filters.tagIds,
		tagTypes: filters.tagTypes,
	};
}

const DEFAULT_DIARY_FILTER_KEY = "default";

function serializeDiaryFilters(filters: DiaryListFilters) {
	const parts = [
		`search=${filters.search?.trim() ?? ""}`,
		`start=${filters.startDate ?? ""}`,
		`end=${filters.endDate ?? ""}`,
		`media=${filters.includeMedia === null || filters.includeMedia === undefined ? "all" : String(filters.includeMedia)}`,
		`tagTypes=${[...(filters.tagTypes ?? [])].sort().join(",")}`,
		`tagIds=${[...(filters.tagIds ?? [])].sort().join(",")}`,
	];
	const key = parts.join("|");

	return key === "search=|start=|end=|media=all|tagTypes=|tagIds="
		? DEFAULT_DIARY_FILTER_KEY
		: key;
}

function normalizeFilters(filters: DiaryFilterState): DiaryFilterState {
	let startDate = filters.startDate;
	let endDate = filters.endDate;

	if (startDate && endDate && endDate < startDate) {
		endDate = startDate;
	}

	return {
		endDate,
		media: filters.media,
		startDate,
		tagIds: [...new Set(filters.tagIds)].sort(),
		tagTypes: [...new Set(filters.tagTypes)].sort(),
	};
}

function removeFilterValue(
	filters: DiaryFilterState,
	key: ActiveFilterKey,
	value?: string,
): DiaryFilterState {
	if (key === "startDate") {
		return { ...filters, startDate: null };
	}

	if (key === "endDate") {
		return { ...filters, endDate: null };
	}

	if (key === "includeMedia") {
		return { ...filters, media: "all" };
	}

	if (key === "tagIds" && value) {
		return { ...filters, tagIds: filters.tagIds.filter((tagId) => tagId !== value) };
	}

	if (key === "tagTypes" && value) {
		return { ...filters, tagTypes: filters.tagTypes.filter((tagType) => tagType !== value) };
	}

	return filters;
}

function getActiveFilterChips(
	filters: DiaryListFilters,
	tags: DiaryTag[],
	timeZone?: string,
	locale = "en-US",
) {
	const tagById = new Map(tags.map((tag) => [tag.id, tag]));
	const chips: { key: ActiveFilterKey; label: string; value?: string }[] = [];

	if (filters.startDate) {
		chips.push({ key: "startDate", label: `From ${formatShortDate(filters.startDate, timeZone, locale)}` });
	}

	if (filters.endDate) {
		chips.push({ key: "endDate", label: `To ${formatShortDate(filters.endDate, timeZone, locale)}` });
	}

	if (filters.includeMedia === true) {
		chips.push({ key: "includeMedia", label: "With media" });
	}

	if (filters.includeMedia === false) {
		chips.push({ key: "includeMedia", label: "No media" });
	}

	for (const tagType of filters.tagTypes ?? []) {
		chips.push({
			key: "tagTypes",
			label: formatTagType(tagType),
			value: tagType,
		});
	}

	for (const tagId of filters.tagIds ?? []) {
		chips.push({
			key: "tagIds",
			label: tagById.get(tagId)?.name ?? "Tag",
			value: tagId,
		});
	}

	return chips;
}

function toggleArrayValue(values: string[], value: string) {
	return values.includes(value)
		? values.filter((currentValue) => currentValue !== value)
		: [...values, value].sort();
}

function dateFromKey(dateKey: string | null) {
	if (!dateKey) {
		return null;
	}

	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);

	return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function formatShortDate(dateKey: string, timeZone?: string, locale = "en-US") {
	const date = dateFromKey(dateKey);

	if (!date) {
		return dateKey;
	}

	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone,
	}).format(date);
}

function formatTagType(type: string) {
	const match = TAG_TYPE_FILTERS.find((filter) => filter.value === type);

	if (match) {
		return match.label;
	}

	return type
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	addButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 999,
		height: 42,
		justifyContent: "center",
		width: 42,
	},
	activeFilterChip: {
		alignItems: "center",
		backgroundColor: "#F1EDFF",
		borderColor: "#DED4FF",
		borderRadius: 999,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	activeFilterRow: {
		gap: spacing.sm,
		paddingBottom: spacing.md,
	},
	activeFilterText: {
		...typography.caption,
		color: themeColors.primary,
	},
	centerState: {
		alignItems: "center",
		gap: spacing.sm,
		padding: spacing.xl,
	},
	clearAllChip: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 999,
		borderWidth: 1,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	clearAllText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	clearIconButton: {
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.xs,
	},
	dateFilterButton: {
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		gap: spacing.xs,
		padding: spacing.md,
	},
	dateFilterRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	dateFilterText: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	disabledAddButton: {
		backgroundColor: themeColors.textSecondary,
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
		color: themeColors.textSecondary,
		textAlign: "center",
	},
	emptyTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
		textAlign: "center",
	},
	footerLoader: {
		paddingVertical: spacing.lg,
	},
	filterChip: {
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	filterChipText: {
		...typography.caption,
	},
	filterChipWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	filterContent: {
		gap: spacing.md,
		paddingVertical: spacing.md,
	},
	filterFooter: {
		flexDirection: "row",
		gap: spacing.md,
		paddingTop: spacing.md,
	},
	filterSectionTitle: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	filterSheet: {
		backgroundColor: themeColors.surface,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		maxHeight: "88%",
		padding: spacing.md,
	},
	filterTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	footerButton: {
		alignItems: "center",
		borderRadius: 14,
		flex: 1,
		paddingVertical: spacing.md,
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
		borderColor: themeColors.border,
		borderRadius: 999,
		borderWidth: 1,
		height: 42,
		justifyContent: "center",
		width: 42,
	},
	helperText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	listContent: {
		gap: spacing.md,
		paddingBottom: spacing.md,
	},
	modalBackdrop: {
		backgroundColor: "rgba(21, 24, 39, 0.35)",
		flex: 1,
		justifyContent: "flex-end"
	},
	noBabyCard: {
		gap: spacing.sm,
	},
	offlineScrollContent: {
		flexGrow: 1,
		justifyContent: "center",
	},
	primaryButton: {
		backgroundColor: themeColors.primary,
	},
	primaryButtonText: {
		...typography.label,
		color: themeColors.surface,
	},
	retryButton: {
		backgroundColor: themeColors.primary,
		borderRadius: 999,
		marginTop: spacing.sm,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	retryText: {
		...typography.caption,
		color: themeColors.surface,
	},
	searchInput: {
		...typography.body,
		color: themeColors.textPrimary,
		flex: 1,
		paddingVertical: spacing.xs,
	},
	searchRow: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 16,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginBottom: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
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
	segmentButton: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		paddingVertical: spacing.sm,
	},
	segmentButtonActive: {
		backgroundColor: themeColors.surface,
	},
	segmentedRow: {
		backgroundColor: themeColors.background,
		borderColor: themeColors.border,
		borderRadius: 999,
		borderWidth: 1,
		flexDirection: "row",
		padding: 3,
	},
	segmentText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	segmentTextActive: {
		color: themeColors.textPrimary,
	},
	tagFilterPill: {
		borderColor: "transparent",
		borderRadius: 999,
		borderWidth: 2,
	},
	tagFilterPillActive: {
		borderColor: themeColors.primary,
	},
});
}
