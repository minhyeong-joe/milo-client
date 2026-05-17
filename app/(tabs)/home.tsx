import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid, type QuickActionItem } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import { SyncStatusCard } from "@/components/sync/SyncStatusCard";
import { useAppPreferences, useTimelineTimeZone , useAppTheme } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import {
	AUTH_REQUIRED_SYNC_MESSAGE,
	OFFLINE_SYNC_MESSAGE,
	useSync,
} from "@/context/SyncContext";
import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { getRoutineDays, type RoutineLastLogged } from "@/services/api/routine";
import {
	loadCachedRoutineHome,
	saveRoutineHomeCache,
} from "@/services/routine/routineOfflineStore";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
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
	const selectedBabyId = selectedBaby?.id ?? null;
	const selectedBabyTimeZone = selectedBaby?.timezone ?? null;
	const sessionUserId = session?.user.id ?? null;
	const [isInitialRoutineLoading, setIsInitialRoutineLoading] = useState(false);
	const [isOlderRoutineLoading, setIsOlderRoutineLoading] = useState(false);
	const [routineError, setRoutineError] = useState<string | null>(null);
	const [nextRoutineStartDate, setNextRoutineStartDate] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const routineRequestIdRef = useRef(0);
	const isOlderRoutineLoadingRef = useRef(false);
	const lastInitialRoutineLoadKeyRef = useRef<string | null>(null);
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
	const quickActions = useMemo<QuickActionItem[]>(
		() => [
			...(["meal", "diaper", "sleep"] as const).map((id) => ({
				id,
				kind: "routine" as const,
				lastActionLabel: getLastLoggedActionLabel(lastLogged, id, currentTime),
			})),
			{
				accentColor: "#D84D8B",
				backgroundColor: "#FFEAF4",
				detailLabel: growthLastLoggedLabel,
				icon: "scale-outline",
				id: "growth",
				kind: "navigation",
				label: "Growth",
				onPress: () => router.push("/baby/growth"),
			},
		],
		[currentTime, growthLastLoggedLabel, lastLogged, router],
	);

	const loadLatestRoutineLogs = useCallback(async ({
		refreshBabyList = false,
		trigger = "manual",
	}: LoadLatestRoutineOptions = {}) => {
		if (!selectedBabyId || !selectedBabyTimeZone) {
			replaceDailyLogs([]);
			setRoutineError(null);
			setNextRoutineStartDate(null);
			setLastLogged(null);
			return;
		}

		const requestId = routineRequestIdRef.current + 1;
		routineRequestIdRef.current = requestId;
		const startDate = getDateKeyInTimeZone(new Date(), selectedBabyTimeZone);
		const isManualSync = trigger === "manual";

		setIsInitialRoutineLoading(true);
		isOlderRoutineLoadingRef.current = false;
		setRoutineError(null);
		setNextRoutineStartDate(null);

		let didLoadCachedData = false;

		try {
			if (sessionUserId) {
				const cached = await loadCachedRoutineHome(sessionUserId, selectedBabyId);

				if (routineRequestIdRef.current === requestId) {
					didLoadCachedData = cached.dailyLogs.length > 0 || cached.lastLogged !== null;
					setLastLogged(cached.lastLogged);

					if (cached.dailyLogs.length > 0) {
						replaceDailyLogs(cached.dailyLogs);
						setNextRoutineStartDate(cached.nextStartDate);
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
				babyId: selectedBabyId,
				count: ROUTINE_PAGE_DAYS,
				includeLastLogged: true,
				startDate,
			}), HOME_SYNC_TIMEOUT_MS);

			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			if (sessionUserId) {
				await saveRoutineHomeCache({
					babyId: selectedBabyId,
					dailyLogs: response.dailyLogs,
					lastLogged: response.lastLogged ?? null,
					nextStartDate: response.nextStartDate,
					userId: sessionUserId,
				});
				const reconciledCache = await loadCachedRoutineHome(sessionUserId, selectedBabyId);

				replaceDailyLogs(reconciledCache.dailyLogs);
				setNextRoutineStartDate(reconciledCache.nextStartDate);
				setLastLogged(reconciledCache.lastLogged);
			} else {
				replaceDailyLogs(response.dailyLogs);
				setNextRoutineStartDate(response.nextStartDate);
				setLastLogged(response.lastLogged ?? null);
			}
			markOnline();
			setRoutineError(null);

		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId) {
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

		isOlderRoutineLoadingRef.current = true;
		setIsOlderRoutineLoading(true);
		setRoutineError(null);

		try {
			const response = await getRoutineDays({
				babyId: selectedBabyId,
				count: ROUTINE_PAGE_DAYS,
				startDate: nextRoutineStartDate,
			});

			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			if (sessionUserId) {
				await saveRoutineHomeCache({
					babyId: selectedBabyId,
					dailyLogs: response.dailyLogs,
					lastLogged,
					nextStartDate: response.nextStartDate,
					userId: sessionUserId,
				});
				const reconciledCache = await loadCachedRoutineHome(sessionUserId, selectedBabyId);

				replaceDailyLogs(reconciledCache.dailyLogs);
				setNextRoutineStartDate(reconciledCache.nextStartDate);
			} else {
				prependOlderDailyLogs(response.dailyLogs);
				setNextRoutineStartDate(response.nextStartDate);
			}

			await syncPendingMutations();
		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId) {
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
								config={routineDisplayConfig}
								currentTime={currentTime}
								day={log}
								defaultView={index === 0 ? "timeline" : "summary"}
								key={log.date}
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
