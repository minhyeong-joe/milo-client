import type { RoutineStyle } from "@/data/homeData";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";

export function RoutineIcon({
	size,
	style,
}: {
	size: number;
	style: RoutineStyle;
}) {
	return (
		<View
			style={[
				styles.iconWrap,
				{
					backgroundColor: style.backgroundColor,
					borderRadius: size / 2,
					height: size,
					width: size,
				},
			]}
		>
			{style.imageSource ? (
				<Image source={style.imageSource} style={styles.imageIcon} />
			) : style.icon ? (
				<Ionicons
					color={style.accentColor}
					name={style.icon}
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
