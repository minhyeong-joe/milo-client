import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import { routineConfig } from "@/data/homeData";
import { homeMockApiResponse } from "@/data/mockAPI/homeAPI";
import { globalStyles } from "@/styles/globalStyles";
import {
	formatBabyAge,
	getLastRoutineActionLabel,
} from "@/utils/routineDisplay";
import { useCurrentMinute } from "@/utils/useCurrentMinute";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
	const { baby, dailyLogs } = homeMockApiResponse;
	const currentDate = useCurrentMinute();
	const currentTime = currentDate.toISOString();
	const [today, ...previousDays] = dailyLogs;
	const latestTimeline = today?.timeline ?? [];
	const quickActions = (["meal", "diaper", "sleep"] as const).map((id) => ({
		id,
		lastActionLabel: getLastRoutineActionLabel(latestTimeline, id, currentTime),
	}));

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<BabyHeader
					ageLabel={formatBabyAge(baby.birthdate, currentDate)}
					baby={baby}
				/>
				<QuickActionGrid actions={quickActions} config={routineConfig} />

				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					{dailyLogs.length > 0 &&
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
	scrollContent: {
		paddingBottom: 8,
	},
});
