import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import type { RoutineKind } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import {
	formatBabyAge,
	getLastRoutineActionLabel,
} from "@/utils/routineDisplay";
import { useCurrentMinute } from "@/utils/useCurrentMinute";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
	const router = useRouter();
	const {
		babies,
		error: babyError,
		isLoading: isBabyLoading,
		refreshBabies,
		selectBaby,
		selectedBaby,
	} = useBabySelection();
	const { dailyLogs, getOngoingSleep } = useRoutineData();
	const currentDate = useCurrentMinute();
	const currentTime = currentDate.toISOString();
	const allTimelineEvents = dailyLogs.flatMap((day) => day.timeline);
	const quickActions = (["meal", "diaper", "sleep"] as const).map((id) => ({
		id,
		lastActionLabel: getLastRoutineActionLabel(allTimelineEvents, id, currentTime),
	}));

	const handleQuickActionPress = (kind: RoutineKind) => {
		if (kind === "meal") {
			router.push("/routine/add-meal");
		} else if (kind === "diaper") {
			router.push("/routine/add-diaper");
		} else if (kind === "sleep") {
			const ongoingSleep = getOngoingSleep();
			router.push({
				pathname: "/routine/add-sleep",
				params: ongoingSleep ? { sleepId: ongoingSleep.id } : undefined,
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
							config={routineConfig}
							onActionPress={handleQuickActionPress}
						/>
					</>
				) : (
					<View style={[globalStyles.card, styles.babyStateCard]}>
						<Text style={styles.babyStateTitle}>
							{isBabyLoading ? "Loading baby profile..." : "No baby profile yet"}
						</Text>
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
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					{selectedBaby &&
						dailyLogs.length > 0 &&
						dailyLogs.map((log, index) => (
							<RoutineDayCard
								config={routineConfig}
								currentTime={currentTime}
								day={log}
								defaultView={index === 0 ? "timeline" : "summary"}
								key={log.date}
							/>
						))}
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
	scrollContent: {
		paddingBottom: 8,
	},
});
