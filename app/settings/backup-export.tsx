import { PlaceholderCard, SettingsHeader } from "@/components/settings/SettingsRows";
import { globalStyles, spacing } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BackupExportScreen() {
	const router = useRouter();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Backup & Export" />
			<ScrollView contentContainerStyle={styles.content}>
				<PlaceholderCard
					icon="cloud-upload-outline"
					message="Export records and diaries, backups, and restore tools"
					title="Backup tools coming soon"
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
