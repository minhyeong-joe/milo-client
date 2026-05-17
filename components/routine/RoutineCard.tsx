import { useAppTheme } from "@/context/AppPreferencesContext";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

export function RoutineCard({ children }: PropsWithChildren) {
	const { globalStyles } = useAppTheme();
	return <View style={[globalStyles.card, globalStyles.shadowCard, styles.card]}>{children}</View>;
}

const styles = StyleSheet.create({
	card: {
		marginBottom: 10,
		marginHorizontal: 10,
	},
});
