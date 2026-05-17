import { PlaceholderCard, SettingsHeader } from "@/components/settings/SettingsRows";
import { spacing } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AIInsightsSettingsScreen() {
	const router = useRouter();
	const { globalStyles } = useAppTheme();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="AI & Insights" />
			<ScrollView contentContainerStyle={styles.content}>
				<PlaceholderCard
					icon="sparkles-outline"
					message="Coming Soon"
					title="AI settings and insight preferences"
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	content: {
		padding: spacing.md,
	},
});
