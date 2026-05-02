import { BabyHeader } from "@/components/routine/BabyHeader";
import { QuickActionGrid } from "@/components/routine/QuickActionGrid";
import { RoutineDayCard } from "@/components/routine/RoutineDayCard";
import type { RoutineKind } from "@/data/homeData";
import { useRoutineData } from "@/context/RoutineDataContext";
import { routineConfig } from "@/data/homeData";
import { homeMockApiResponse } from "@/data/mockAPI/homeAPI";
import { globalStyles } from "@/styles/globalStyles";
import {
	formatBabyAge,
	getLastRoutineActionLabel,
} from "@/utils/routineDisplay";
import { useCurrentMinute } from "@/utils/useCurrentMinute";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
	const router = useRouter();
	const { baby } = homeMockApiResponse; // TODO: replace with real data from context
	const { dailyLogs } = useRoutineData();
	const currentDate = useCurrentMinute();
	const currentTime = currentDate.toISOString();
	const [today] = dailyLogs;
	const latestTimeline = today?.timeline ?? [];
	const quickActions = (["meal", "diaper", "sleep"] as const).map((id) => ({
		id,
		lastActionLabel: getLastRoutineActionLabel(latestTimeline, id, currentTime),
	}));

	const handleQuickActionPress = (kind: RoutineKind) => {
		if (kind === "meal") {
			router.push("/routine/add-meal");
		} else if (kind === "diaper") {
			router.push("/routine/add-diaper");
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<BabyHeader
					ageLabel={formatBabyAge(baby.birthdate, currentDate)}
					baby={baby}
				/>
				<QuickActionGrid
					actions={quickActions}
					config={routineConfig}
					onActionPress={handleQuickActionPress}
				/>

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
