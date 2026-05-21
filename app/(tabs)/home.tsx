import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid, type QuickActionItem } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import { SyncStatusCard } from "@/components/sync/SyncStatusCard";
import { useAppPreferences, useAppTheme, useDisplayTimeZone, useTimelineTimeZone } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import { useImmunizationData } from "@/context/ImmunizationDataContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import {
	AUTH_REQUIRED_SYNC_MESSAGE,
	OFFLINE_SYNC_MESSAGE,
	useSync,
} from "@/context/SyncContext";
import { FEATURE_VISUALS } from "@/constants/featureVisuals";
import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import {
	getDailyRoutineInsight,
	listDailyRoutineInsightStatuses,
	type DailyRoutineInsight,
} from "@/services/api/ai";
import { getRoutineDays, type RoutineLastLogged } from "@/services/api/routine";
import {
	loadCachedRoutineHome,
	saveRoutineHomeCache,
} from "@/services/routine/routineOfflineStore";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { getImmunizationStatusLabel } from "@/utils/immunizationStatus";
import { formatBabyAge } from "@/utils/routineDisplay";
import { useCurrentMinute } from "@/utils/useCurrentMinute";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ROUTINE_PAGE_DAYS = 7;
const HOME_SYNC_TIMEOUT_MS = 10000;
type LoadLatestRoutineOptions = {
	refreshBabyList?: boolean;
	trigger?: "initial" | "manual";
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function HomeScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { authStatus, session } = useAuthSession();
	const { languagePreference, preferredVolumeUnit } = useAppPreferences();
	const { growthRecords } = useGrowthData();
	const {
		records: immunizationRecords,
		scheduleItems: immunizationScheduleItems,
	} = useImmunizationData();

	const {
		babies,
		error: babyError,
		isLoading: isBabyLoading,
		refreshBabies,
		selectBaby,
		selectedBaby,
	} = useBabySelection();
	const {
		dailyLogs,
		getOngoingSleep,
		lastLogged,
		prependOlderDailyLogs,
		replaceDailyLogs,
		setLastLogged,
		syncError,
		syncPendingMutations,
	} = useRoutineData();
	const {
		connectionStatus,
		error: syncProviderError,
		markAuthRequired,
		markOffline,
		markOnline,
		status: syncStatus,
	} = useSync();
	const currentDate = useCurrentMinute();
	const currentTime = currentDate.toISOString();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const displayTimeZone = useDisplayTimeZone(selectedBaby);
	const selectedBabyId = selectedBaby?.id ?? null;
	const selectedBabyTimeZone = selectedBaby?.timezone ?? null;
	const sessionUserId = session?.user.id ?? null;
	const [isInitialRoutineLoading, setIsInitialRoutineLoading] = useState(false);
	const [isOlderRoutineLoading, setIsOlderRoutineLoading] = useState(false);
	const [routineError, setRoutineError] = useState<string | null>(null);
	const [nextRoutineStartDate, setNextRoutineStartDate] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [aiInsightsByDate, setAiInsightsByDate] = useState<Record<string, DailyRoutineInsight>>({});
	const routineRequestIdRef = useRef(0);
	const isOlderRoutineLoadingRef = useRef(false);
	const lastInitialRoutineLoadKeyRef = useRef<string | null>(null);
	const selectedBabyIdRef = useRef<string | null>(null);
	const aiStatusInFlightKeysRef = useRef<Set<string>>(new Set());
	const aiStatusLoadedKeysRef = useRef<Set<string>>(new Set());
	const syncBannerMessage = syncProviderError ?? routineError ?? syncError;
	const routineDisplayConfig = useMemo<RoutineConfig>(
		() => ({
			...routineConfig,
			preferredVolumeUnit,
		}),
		[preferredVolumeUnit],
	);
	const growthLastLoggedLabel = useMemo(
		() => getLastGrowthLoggedLabel(growthRecords, languagePreference),
		[growthRecords, languagePreference],
	);
	const immunizationStatusLabel = useMemo(
		() => getImmunizationStatusLabel(
			immunizationScheduleItems,
			immunizationRecords,
			selectedBaby?.birthdate,
		),
		[immunizationRecords, immunizationScheduleItems, selectedBaby?.birthdate],
	);
	const quickActions = useMemo<QuickActionItem[]>(
		() => [
			...(["meal", "diaper", "sleep"] as const).map((id) => ({
				id,
				kind: "routine" as const,
				lastActionLabel: getLastLoggedActionLabel(lastLogged, id, currentTime),
			})),
			{
				accentColor: FEATURE_VISUALS.growth.accentColor,
				backgroundColor: FEATURE_VISUALS.growth.backgroundColor,
				detailLabel: growthLastLoggedLabel,
				icon: FEATURE_VISUALS.growth.icon,
				id: "growth",
				kind: "navigation",
				label: "Growth",
				onPress: () => router.push("/baby/growth"),
			},
			{
				accentColor: FEATURE_VISUALS.immunization.accentColor,
				backgroundColor: FEATURE_VISUALS.immunization.backgroundColor,
				detailLabel: immunizationStatusLabel,
				icon: FEATURE_VISUALS.immunization.icon,
				id: "immunization",
				kind: "navigation",
				label: "Immunization",
				onPress: () => router.push("/baby/immunization"),
			},
		],
		[currentTime, growthLastLoggedLabel, immunizationStatusLabel, lastLogged, router],
	);

	const loadAiInsightStatuses = useCallback(async (logs: { date: string }[]) => {
		if (!selectedBabyId || !selectedBabyTimeZone || logs.length === 0) {
			return;
		}

		const babyId = selectedBabyId;
		const todayKey = getDateKeyInTimeZone(new Date(), selectedBabyTimeZone);
		const dates = logs
			.map((log) => log.date)
			.filter((date) => date < todayKey)
			.sort();

		if (dates.length === 0) {
			return;
		}

		let pendingRanges: string[][] = [];

		try {
			pendingRanges = chunkDates(dates, 30).filter((range) => {
				const rangeKey = getAiStatusRangeKey(babyId, range[0], range[range.length - 1]);

				if (
					aiStatusLoadedKeysRef.current.has(rangeKey) ||
					aiStatusInFlightKeysRef.current.has(rangeKey)
				) {
					return false;
				}

				aiStatusInFlightKeysRef.current.add(rangeKey);
				return true;
			});

			if (pendingRanges.length === 0) {
				return;
			}

			const responses = await Promise.all(
				pendingRanges.map((range) =>
					listDailyRoutineInsightStatuses({
						babyId,
						startDate: range[0],
						endDate: range[range.length - 1],
					}),
				),
			);

			if (selectedBabyIdRef.current !== babyId) {
				return;
			}

			setAiInsightsByDate((current) => {
				const next = { ...current };

				responses.forEach((response) => {
					response.insights.forEach((insight) => {
						next[insight.analysisDate] = insight;
					});
				});

				return next;
			});
			pendingRanges.forEach((range) => {
				aiStatusLoadedKeysRef.current.add(getAiStatusRangeKey(babyId, range[0], range[range.length - 1]));
			});
		} catch (error) {
			console.warn("Could not load AI insight statuses", error);
		} finally {
			pendingRanges.forEach((range) => {
				aiStatusInFlightKeysRef.current.delete(getAiStatusRangeKey(babyId, range[0], range[range.length - 1]));
			});
		}
	}, [selectedBabyId, selectedBabyTimeZone]);

	const generateAiInsight = useCallback(async (date: string) => {
		if (!selectedBabyId) {
			throw new Error("Choose a baby before generating an insight.");
		}

		const response = await getDailyRoutineInsight({
			babyId: selectedBabyId,
			date,
		});

		setAiInsightsByDate((current) => ({
			...current,
			[date]: response.insight,
		}));
	}, [selectedBabyId]);

	const loadLatestRoutineLogs = useCallback(async ({
		refreshBabyList = false,
		trigger = "manual",
	}: LoadLatestRoutineOptions = {}) => {
		if (!selectedBabyId || !selectedBabyTimeZone) {
			replaceDailyLogs([]);
			setAiInsightsByDate({});
			setRoutineError(null);
			setNextRoutineStartDate(null);
			setLastLogged(null);
			return;
		}

		const babyId = selectedBabyId;
		const babyTimeZone = selectedBabyTimeZone;
		const userId = sessionUserId;
		const requestId = routineRequestIdRef.current + 1;
		routineRequestIdRef.current = requestId;
		const startDate = getDateKeyInTimeZone(new Date(), babyTimeZone);
		const isManualSync = trigger === "manual";

		setIsInitialRoutineLoading(true);
		isOlderRoutineLoadingRef.current = false;
		setRoutineError(null);
		setNextRoutineStartDate(null);
		setAiInsightsByDate({});

		let didLoadCachedData = false;

		try {
			if (userId) {
				const cached = await loadCachedRoutineHome(userId, babyId);

				if (routineRequestIdRef.current === requestId && selectedBabyIdRef.current === babyId) {
					didLoadCachedData = cached.dailyLogs.length > 0 || cached.lastLogged !== null;
					setLastLogged(cached.lastLogged);

					if (cached.dailyLogs.length > 0) {
						replaceDailyLogs(cached.dailyLogs);
						setNextRoutineStartDate(cached.nextStartDate);
						void loadAiInsightStatuses(cached.dailyLogs);
					}
				}
			} else {
				setLastLogged(null);
			}

			if (routineRequestIdRef.current === requestId && !didLoadCachedData) {
				setLastLogged(null);
			}

			if (authStatus === "authRequiredForSync") {
				markAuthRequired();
				setRoutineError(AUTH_REQUIRED_SYNC_MESSAGE);
				return;
			}

			if (isManualSync) {
				if (refreshBabyList) {
					await withTimeout(refreshBabies(), HOME_SYNC_TIMEOUT_MS);
				}

				await withTimeout(syncPendingMutations(), HOME_SYNC_TIMEOUT_MS);
			}

			const response = await withTimeout(getRoutineDays({
				babyId,
				count: ROUTINE_PAGE_DAYS,
				includeLastLogged: true,
				startDate,
			}), HOME_SYNC_TIMEOUT_MS);

			if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
				return;
			}

			if (userId) {
				await saveRoutineHomeCache({
					babyId,
					dailyLogs: response.dailyLogs,
					lastLogged: response.lastLogged ?? null,
					nextStartDate: response.nextStartDate,
					userId,
				});
				const reconciledCache = await loadCachedRoutineHome(userId, babyId);

				if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
					return;
				}

				replaceDailyLogs(reconciledCache.dailyLogs);
				setNextRoutineStartDate(reconciledCache.nextStartDate);
				setLastLogged(reconciledCache.lastLogged);
				void loadAiInsightStatuses(reconciledCache.dailyLogs);
			} else {
				replaceDailyLogs(response.dailyLogs);
				setNextRoutineStartDate(response.nextStartDate);
				setLastLogged(response.lastLogged ?? null);
				void loadAiInsightStatuses(response.dailyLogs);
			}
			markOnline();
			setRoutineError(null);

		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
				return;
			}

			if (isAuthRequiredError(caughtError)) {
				markAuthRequired();
				setRoutineError(AUTH_REQUIRED_SYNC_MESSAGE);
			} else {
				markOffline();
				setRoutineError(didLoadCachedData ? OFFLINE_SYNC_MESSAGE : getErrorMessage(caughtError));
			}
		} finally {
			if (routineRequestIdRef.current === requestId) {
				setIsInitialRoutineLoading(false);
			}
		}
	}, [
		authStatus,
		loadAiInsightStatuses,
		markAuthRequired,
		markOffline,
		markOnline,
		refreshBabies,
		replaceDailyLogs,
		selectedBabyId,
		selectedBabyTimeZone,
		sessionUserId,
		setLastLogged,
		syncPendingMutations,
	]);

	const initialRoutineLoadKey = useMemo(() => {
		if (!sessionUserId) {
			return null;
		}

		if (!selectedBabyId || !selectedBabyTimeZone) {
			return `${sessionUserId}:no-baby`;
		}

		return `${sessionUserId}:${selectedBabyId}:${selectedBabyTimeZone}`;
	}, [selectedBabyId, selectedBabyTimeZone, sessionUserId]);

	useEffect(() => {
		selectedBabyIdRef.current = selectedBabyId;
		routineRequestIdRef.current += 1;
		isOlderRoutineLoadingRef.current = false;
		setIsOlderRoutineLoading(false);
		setRoutineError(null);
		setNextRoutineStartDate(null);
		setAiInsightsByDate({});
		aiStatusInFlightKeysRef.current.clear();
		aiStatusLoadedKeysRef.current.clear();
	}, [selectedBabyId]);

	useEffect(() => {
		if (!initialRoutineLoadKey) {
			return;
		}

		if (lastInitialRoutineLoadKeyRef.current === initialRoutineLoadKey) {
			return;
		}

		lastInitialRoutineLoadKeyRef.current = initialRoutineLoadKey;
		void loadLatestRoutineLogs({ trigger: "initial" });
	}, [initialRoutineLoadKey, loadLatestRoutineLogs]);

	const refreshHome = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await loadLatestRoutineLogs({ refreshBabyList: true, trigger: "manual" });
		} finally {
			setIsRefreshing(false);
		}
	}, [loadLatestRoutineLogs]);

	const loadOlderRoutineLogs = useCallback(async () => {
		if (
			!selectedBabyId ||
			isInitialRoutineLoading ||
			isOlderRoutineLoadingRef.current ||
			!nextRoutineStartDate
		) {
			return;
		}

		const requestId = routineRequestIdRef.current;
		const babyId = selectedBabyId;
		const userId = sessionUserId;

		isOlderRoutineLoadingRef.current = true;
		setIsOlderRoutineLoading(true);
		setRoutineError(null);

		try {
			const response = await getRoutineDays({
				babyId,
				count: ROUTINE_PAGE_DAYS,
				startDate: nextRoutineStartDate,
			});

			if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
				return;
			}

			if (userId) {
				await saveRoutineHomeCache({
					babyId,
					dailyLogs: response.dailyLogs,
					lastLogged,
					nextStartDate: response.nextStartDate,
					userId,
				});
				const reconciledCache = await loadCachedRoutineHome(userId, babyId);

				if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
					return;
				}

				replaceDailyLogs(reconciledCache.dailyLogs);
				setNextRoutineStartDate(reconciledCache.nextStartDate);
				void loadAiInsightStatuses(response.dailyLogs);
			} else {
				prependOlderDailyLogs(response.dailyLogs);
				setNextRoutineStartDate(response.nextStartDate);
				void loadAiInsightStatuses(response.dailyLogs);
			}

			await syncPendingMutations();
		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId || selectedBabyIdRef.current !== babyId) {
				return;
			}

			markOffline();
			setRoutineError(dailyLogs.length > 0 ? OFFLINE_SYNC_MESSAGE : getErrorMessage(caughtError));
		} finally {
			if (routineRequestIdRef.current === requestId) {
				isOlderRoutineLoadingRef.current = false;
				setIsOlderRoutineLoading(false);
			}
		}
	}, [
		dailyLogs.length,
		isInitialRoutineLoading,
		lastLogged,
		loadAiInsightStatuses,
		markOffline,
		nextRoutineStartDate,
		prependOlderDailyLogs,
		replaceDailyLogs,
		selectedBabyId,
		sessionUserId,
		syncPendingMutations,
	]);

	const handleQuickActionPress = (kind: RoutineKind) => {
		if (kind === "meal") {
			router.push("/routine/add-meal");
		} else if (kind === "diaper") {
			router.push("/routine/add-diaper");
		} else if (kind === "sleep") {
			const ongoingSleep = getOngoingSleep();
			const activeSleepId = ongoingSleep?.id ?? (
				lastLogged?.sleep?.isActive ? lastLogged.sleep.id : undefined
			);
			router.push({
				pathname: "/routine/add-sleep",
				params: activeSleepId ? { sleepId: activeSleepId } : undefined,
			});
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				{selectedBaby ? (
					<>
						<BabyHeader
							ageLabel={formatBabyAge(selectedBaby.birthdate, currentDate)}
							babies={babies}
							baby={selectedBaby}
							onSelectBaby={selectBaby}
						/>
						<QuickActionGrid
							actions={quickActions}
							config={routineDisplayConfig}
							onActionPress={handleQuickActionPress}
						/>
					</>
				) : (
					<View style={[globalStyles.card, styles.babyStateCard]}>
						<Text style={styles.babyStateTitle}>
							{isBabyLoading ? "Loading baby profile..." : "No baby profile yet"}
						</Text>
						{isBabyLoading && (
							<ActivityIndicator
								color={themeColors.primary}
								size="small"
								style={styles.inlineSpinner}
							/>
						)}
						<Text style={styles.babyStateText}>
							{babyError ??
								(isBabyLoading
									? "Getting your baby list."
									: "Add a baby profile to start tracking routines.")}
						</Text>
						{babyError && (
							<Pressable
								accessibilityRole="button"
								onPress={() => void refreshBabies()}
								style={styles.retryButton}
							>
								<Text style={styles.retryButtonText}>Try again</Text>
							</Pressable>
						)}
					</View>
				)}

				<ScrollView
					contentContainerStyle={globalStyles.scrollContent}
					onScroll={({ nativeEvent }) => {
						if (isNearBottom(nativeEvent)) {
							void loadOlderRoutineLogs();
						}
					}}
					refreshControl={
						<RefreshControl
							colors={[themeColors.primary]}
							onRefresh={() => void refreshHome()}
							refreshing={isRefreshing}
							tintColor={themeColors.primary}
						/>
					}
					scrollEventThrottle={250}
					showsVerticalScrollIndicator={false}
				>
					{selectedBaby && isInitialRoutineLoading && dailyLogs.length > 0 && (
						<SyncStatusCard status="syncing" />
					)}
					{selectedBaby && syncStatus === "syncing" && !isInitialRoutineLoading && !syncBannerMessage && dailyLogs.length > 0 && (
						<SyncStatusCard status="syncing" />
					)}
					{selectedBaby && !isInitialRoutineLoading && syncStatus !== "syncing" && connectionStatus !== "online" && dailyLogs.length > 0 && (
						<SyncStatusCard
							message={syncBannerMessage}
							onRetry={() => void loadLatestRoutineLogs({ trigger: "manual" })}
							status={connectionStatus === "authRequired" ? "authRequired" : "offline"}
						/>
					)}
					{selectedBaby && isInitialRoutineLoading && dailyLogs.length === 0 && (
						<View style={[globalStyles.card, styles.routineStateCard]}>
							<Text style={styles.routineStateTitle}>Loading routine history...</Text>
							<ActivityIndicator
								color={themeColors.primary}
								size="small"
								style={styles.inlineSpinner}
							/>
							<Text style={styles.routineStateText}>Getting the latest routine days.</Text>
						</View>
					)}
					{selectedBaby && routineError && dailyLogs.length === 0 && (
						<View style={[globalStyles.card, styles.routineStateCard]}>
							<Text style={styles.routineStateTitle}>Could not load routine history</Text>
							<Text style={styles.routineStateText}>{routineError}</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => void loadLatestRoutineLogs({ trigger: "manual" })}
								style={styles.retryButton}
							>
								<Text style={styles.retryButtonText}>Try again</Text>
							</Pressable>
						</View>
					)}
					{selectedBaby &&
						!isInitialRoutineLoading &&
						!routineError &&
						dailyLogs.length === 0 && (
							<View style={[globalStyles.card, styles.routineStateCard]}>
								<Text style={styles.routineStateTitle}>No routine logs yet</Text>
								<Text style={styles.routineStateText}>
									New meal, diaper, and sleep logs will appear here.
								</Text>
							</View>
						)}
					{selectedBaby &&
						dailyLogs.length > 0 &&
						dailyLogs.map((log, index) => (
							<RoutineDayCard
								aiInsight={aiInsightsByDate[log.date]}
								config={routineDisplayConfig}
								currentTime={currentTime}
								day={log}
								defaultView={index === 0 ? "timeline" : "summary"}
								displayTimeZone={displayTimeZone}
								key={log.date}
								onGenerateAiInsight={generateAiInsight}
								timeZone={timelineTimeZone}
							/>
						))}
					{selectedBaby && isOlderRoutineLoading && (
						<Text style={styles.loadingMoreText}>Loading older days...</Text>
					)}
				</ScrollView>
			</View>
		</SafeAreaView>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	babyStateCard: {
		marginBottom: spacing.md,
	},
	babyStateText: {
		color: themeColors.textSecondary,
		fontSize: 14,
		lineHeight: 20,
		marginTop: spacing.xs,
	},
	babyStateTitle: {
		color: themeColors.textPrimary,
		fontSize: 17,
		fontWeight: "800",
	},
	retryButton: {
		alignSelf: "flex-start",
		backgroundColor: themeColors.primary,
		borderRadius: 8,
		marginTop: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	retryButtonText: {
		color: themeColors.surface,
		fontSize: 14,
		fontWeight: "800",
	},
	routineStateCard: {
		marginBottom: spacing.md,
	},
	routineStateText: {
		color: themeColors.textSecondary,
		fontSize: 14,
		lineHeight: 20,
		marginTop: spacing.xs,
	},
	routineStateTitle: {
		color: themeColors.textPrimary,
		fontSize: 17,
		fontWeight: "800",
	},
	loadingMoreText: {
		color: themeColors.textSecondary,
		fontSize: 13,
		fontWeight: "700",
		paddingBottom: spacing.md,
		textAlign: "center",
	},
	inlineSpinner: {
		alignSelf: "flex-start",
		marginTop: spacing.sm,
	},
	syncBanner: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginBottom: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	syncBannerText: {
		color: themeColors.textSecondary,
		flex: 1,
		fontSize: 13,
		fontWeight: "700",
	},
	syncRetryButton: {
		backgroundColor: themeColors.primary,
		borderRadius: 8,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	syncRetryText: {
		color: themeColors.surface,
		fontSize: 12,
		fontWeight: "800",
	},
});
}

function getDateKeyInTimeZone(value: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(value);
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

	return `${byType.year}-${byType.month}-${byType.day}`;
}

function chunkDates(dates: string[], size: number) {
	const chunks: string[][] = [];

	for (let index = 0; index < dates.length; index += size) {
		chunks.push(dates.slice(index, index + size));
	}

	return chunks;
}

function getAiStatusRangeKey(babyId: string, startDate: string, endDate: string) {
	return `${babyId}:${startDate}:${endDate}`;
}

function isNearBottom({
	contentOffset,
	contentSize,
	layoutMeasurement,
}: {
	contentOffset: { y: number };
	contentSize: { height: number };
	layoutMeasurement: { height: number };
}) {
	return contentOffset.y + layoutMeasurement.height >= contentSize.height - 160;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error && error.message === "SYNC_TIMEOUT") {
		return OFFLINE_SYNC_MESSAGE;
	}

	if (error instanceof Error) {
		return OFFLINE_SYNC_MESSAGE;
	}

	return "Something went wrong. Please try again.";
}

function isAuthRequiredError(error: unknown) {
	return error instanceof Error &&
		error.message.toLowerCase().includes("unauthorized");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error("SYNC_TIMEOUT")), timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
}

function getLastLoggedActionLabel(
	lastLogged: RoutineLastLogged | null,
	kind: RoutineKind,
	currentTime: string,
) {
	if (!lastLogged) {
		return "No logs yet";
	}

	const loggedAt =
		kind === "sleep" ? lastLogged.sleep?.lastLoggedAt : lastLogged[kind]?.time;

	if (kind === "sleep" && lastLogged.sleep?.isActive) {
		return "Sleeping...";
	}

	if (!loggedAt) {
		return "No logs yet";
	}

	return formatLastLoggedLabel(loggedAt, currentTime);
}

function formatLastLoggedLabel(loggedAt: string, currentTime: string) {
	const diffMinutes = Math.max(
		0,
		Math.round((new Date(currentTime).getTime() - new Date(loggedAt).getTime()) / 60000),
	);

	if (diffMinutes < 60) {
		return `Last: ${diffMinutes}m ago`;
	}

	const hours = Math.floor(diffMinutes / 60);
	const minutes = diffMinutes % 60;

	if (hours < 24) {
		return minutes === 0 ? `Last: ${hours}h ago` : `Last: ${hours}h ${minutes}m ago`;
	}

	const days = Math.floor(hours / 24);
	return days === 1 ? "Last: yesterday" : `Last: ${days}d ago`;
}

function getLastGrowthLoggedLabel(
	records: { measuredDate: string }[],
	locale: string,
) {
	const latestDate = records.reduce<string | null>((latest, record) => {
		if (!record.measuredDate) {
			return latest;
		}

		return !latest || record.measuredDate > latest ? record.measuredDate : latest;
	}, null);

	if (!latestDate) {
		return "No entries yet";
	}

	return `Last: ${formatGrowthDate(latestDate, locale)}`;
}

function formatGrowthDate(dateKey: string, locale: string) {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);

	if (Number.isNaN(date.getTime())) {
		return dateKey;
	}

	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: "numeric"
	}).format(date);
}
