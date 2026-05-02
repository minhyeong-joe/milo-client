import type { RoutineConfig, RoutineEvent } from "@/data/homeData";
import { View } from "react-native";
import { TimelineRow } from "./TimelineRow";

export function Timeline({
	config,
	currentTime,
	events,
}: {
	config: RoutineConfig;
	currentTime: string;
	events: RoutineEvent[];
}) {
	return (
		<View>
			<View>
				{events.map((event, index) => (
					<TimelineRow
						config={config}
						currentTime={currentTime}
						event={event}
						isLast={index === events.length - 1}
						key={event.id}
					/>
				))}
			</View>
		</View>
	);
}
