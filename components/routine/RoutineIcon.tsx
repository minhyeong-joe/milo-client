import type { RoutineStyle } from "@/data/homeData";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import { type RoutineKind, routineConfig, type RoutineConfig } from "@/data/homeData";

export function RoutineIcon({
	size,
	kind,
	customStyle,
}: {
	size: number;
	kind: RoutineKind;
	customStyle?: object | object[] | undefined;
}) {
	const iconInfo: RoutineConfig["quickActions"][RoutineKind] = routineConfig.quickActions[kind];

	return (
		<View
			style={[
				styles.iconWrap,
				customStyle,
				{
					backgroundColor: iconInfo.backgroundColor,
					borderRadius: size / 2,
					height: size,
					width: size,
				},
			]}
		>
			{iconInfo.imageSource ? (
				<Image source={iconInfo.imageSource} style={styles.imageIcon} />
			) : iconInfo.icon ? (
				<Ionicons
					color={iconInfo.accentColor}
					name={iconInfo.icon}
					size={Math.round(size * 0.55)}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	iconWrap: {
		alignItems: "center",
		justifyContent: "center",
	},
	imageIcon: {
		height: "80%",
		resizeMode: "contain",
		width: "80%",
	},
});
