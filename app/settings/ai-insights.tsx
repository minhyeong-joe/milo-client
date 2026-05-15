import { PlaceholderCard, SettingsHeader } from "@/components/settings/SettingsRows";
import { globalStyles, spacing } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AIInsightsSettingsScreen() {
	const router = useRouter();

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
