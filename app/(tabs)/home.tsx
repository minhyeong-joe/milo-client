import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { getRoutineDays, type RoutineLastLogged } from "@/services/api/routine";
import {
	loadCachedRoutineHome,
	saveRoutineHomeCache,
} from "@/services/routine/routineOfflineStore";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
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
const OFFLINE_ROUTINE_MESSAGE = "Offline mode. Sync will be re-enabled once online.";

export default function HomeScreen() {
	const router = useRouter();
	const { session } = useAuthSession();
	const { preferredVolumeUnit } = useAppPreferences();
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
	const currentDate = useCurrentMinute();
	const currentTime = currentDate.toISOString();
	const [isInitialRoutineLoading, setIsInitialRoutineLoading] = useState(false);
	const [isOlderRoutineLoading, setIsOlderRoutineLoading] = useState(false);
	const [routineError, setRoutineError] = useState<string | null>(null);
	const [nextRoutineStartDate, setNextRoutineStartDate] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const routineRequestIdRef = useRef(0);
	const isOlderRoutineLoadingRef = useRef(false);
	const syncBannerMessage = routineError ?? syncError;
	const routineDisplayConfig = useMemo<RoutineConfig>(
		() => ({
			...routineConfig,
			preferredVolumeUnit,
		}),
		[preferredVolumeUnit],
	);
	const quickActions = (["meal", "diaper", "sleep"] as const).map((id) => ({
		id,
		lastActionLabel: getLastLoggedActionLabel(lastLogged, id, currentTime),
	}));

	const loadLatestRoutineLogs = useCallback(async () => {
		if (!selectedBaby) {
			replaceDailyLogs([]);
			setRoutineError(null);
			setNextRoutineStartDate(null);
			setLastLogged(null);
			return;
		}

		const requestId = routineRequestIdRef.current + 1;
		routineRequestIdRef.current = requestId;
		const startDate = getDateKeyInTimeZone(new Date(), selectedBaby.timezone);

		replaceDailyLogs([]);
		setIsInitialRoutineLoading(true);
		isOlderRoutineLoadingRef.current = false;
		setRoutineError(null);
		setNextRoutineStartDate(null);

		let didLoadCachedData = false;

		try {
			if (session) {
				const cached = await loadCachedRoutineHome(session.user.id, selectedBaby.id);

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

			const response = await getRoutineDays({
				babyId: selectedBaby.id,
				count: ROUTINE_PAGE_DAYS,
				includeLastLogged: true,
				startDate,
			});

			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			replaceDailyLogs(response.dailyLogs);
			setNextRoutineStartDate(response.nextStartDate);
			setLastLogged(response.lastLogged ?? null);

			if (session) {
				await saveRoutineHomeCache({
					babyId: selectedBaby.id,
					dailyLogs: response.dailyLogs,
					lastLogged: response.lastLogged ?? null,
					nextStartDate: response.nextStartDate,
					userId: session.user.id,
				});
			}

			await syncPendingMutations();
		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			setRoutineError(didLoadCachedData ? OFFLINE_ROUTINE_MESSAGE : getErrorMessage(caughtError));
		} finally {
			if (routineRequestIdRef.current === requestId) {
				setIsInitialRoutineLoading(false);
			}
		}
	}, [replaceDailyLogs, selectedBaby, session, setLastLogged, syncPendingMutations]);

	useEffect(() => {
		void loadLatestRoutineLogs();
	}, [loadLatestRoutineLogs]);

	const refreshHome = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await Promise.all([
				refreshBabies(),
				loadLatestRoutineLogs(),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [loadLatestRoutineLogs, refreshBabies]);

	const loadOlderRoutineLogs = useCallback(async () => {
		if (
			!selectedBaby ||
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
				babyId: selectedBaby.id,
				count: ROUTINE_PAGE_DAYS,
				startDate: nextRoutineStartDate,
			});

			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			prependOlderDailyLogs(response.dailyLogs);
			setNextRoutineStartDate(response.nextStartDate);

			if (session) {
				await saveRoutineHomeCache({
					babyId: selectedBaby.id,
					dailyLogs: response.dailyLogs,
					lastLogged,
					nextStartDate: response.nextStartDate,
					userId: session.user.id,
				});
			}

			await syncPendingMutations();
		} catch (caughtError) {
			if (routineRequestIdRef.current !== requestId) {
				return;
			}

			setRoutineError(dailyLogs.length > 0 ? OFFLINE_ROUTINE_MESSAGE : getErrorMessage(caughtError));
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
		nextRoutineStartDate,
		prependOlderDailyLogs,
		selectedBaby,
		session,
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
								color={colors.light.primary}
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
							colors={[colors.light.primary]}
							onRefresh={() => void refreshHome()}
							refreshing={isRefreshing}
							tintColor={colors.light.primary}
						/>
					}
					scrollEventThrottle={250}
					showsVerticalScrollIndicator={false}
				>
					{selectedBaby && isInitialRoutineLoading && dailyLogs.length > 0 && (
						<View style={styles.syncBanner}>
							<ActivityIndicator color={colors.light.primary} size="small" />
							<Text style={styles.syncBannerText}>Sync in progress...</Text>
						</View>
					)}
					{selectedBaby && syncBannerMessage && dailyLogs.length > 0 && (
						<View style={styles.syncBanner}>
							<Text style={styles.syncBannerText}>{syncBannerMessage}</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => void loadLatestRoutineLogs()}
								style={styles.syncRetryButton}
							>
								<Text style={styles.syncRetryText}>Try again</Text>
							</Pressable>
						</View>
					)}
					{selectedBaby && isInitialRoutineLoading && dailyLogs.length === 0 && (
						<View style={[globalStyles.card, styles.routineStateCard]}>
							<Text style={styles.routineStateTitle}>Loading routine history...</Text>
							<ActivityIndicator
								color={colors.light.primary}
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
								onPress={() => void loadLatestRoutineLogs()}
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

const styles = StyleSheet.create({
	babyStateCard: {
		marginBottom: spacing.md,
	},
	babyStateText: {
		color: colors.light.textSecondary,
		fontSize: 14,
		lineHeight: 20,
		marginTop: spacing.xs,
	},
	babyStateTitle: {
		color: colors.light.textPrimary,
		fontSize: 17,
		fontWeight: "800",
	},
	retryButton: {
		alignSelf: "flex-start",
		backgroundColor: colors.light.primary,
		borderRadius: 8,
		marginTop: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	retryButtonText: {
		color: colors.light.surface,
		fontSize: 14,
		fontWeight: "800",
	},
	routineStateCard: {
		marginBottom: spacing.md,
	},
	routineStateText: {
		color: colors.light.textSecondary,
		fontSize: 14,
		lineHeight: 20,
		marginTop: spacing.xs,
	},
	routineStateTitle: {
		color: colors.light.textPrimary,
		fontSize: 17,
		fontWeight: "800",
	},
	loadingMoreText: {
		color: colors.light.textSecondary,
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
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		marginBottom: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	syncBannerText: {
		color: colors.light.textSecondary,
		flex: 1,
		fontSize: 13,
		fontWeight: "700",
	},
	syncRetryButton: {
		backgroundColor: colors.light.primary,
		borderRadius: 8,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	syncRetryText: {
		color: colors.light.surface,
		fontSize: 12,
		fontWeight: "800",
	},
});

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
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
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
