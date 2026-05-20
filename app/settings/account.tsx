import { useMemo } from "react";
import {
	SettingsGroup,
	SettingsHeader,
	SettingsRow,
} from "@/components/settings/SettingsRows";
import { useAuthSession } from "@/context/AuthSessionContext";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function AccountScreen() {
	const router = useRouter();
	const { globalStyles, styles } = useThemeStyles();
	const { session, signOut } = useAuthSession();
	const user = session?.user;

	const handleSignOut = async () => {
		await signOut();
		router.replace("/sign-in");
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Account" />
			<ScrollView contentContainerStyle={styles.content}>
				<SettingsGroup>
					<SettingsRow
						disabled
						icon="card-outline"
						iconBackground="#EAF8EF"
						iconColor="#2FAE62"
						subtitle="Free"
						title="Subscription Plan"
					/>
					<SettingsRow
						disabled
						icon="cloud-outline"
						iconBackground="#EAFBFF"
						iconColor="#0EA5E9"
						subtitle="5 GB"
						title="Storage"
					/>
				</SettingsGroup>

				<SettingsGroup>
					<SettingsRow
						disabled
						icon="mail-outline"
						iconBackground="#F7F8FC"
						iconColor="#64748B"
						subtitle={user?.email ?? "Not signed in"}
						title="Email / Security"
					/>
					<SettingsRow
						icon="sparkles-outline"
						iconBackground="#F1ECFF"
						iconColor="#7C5CE7"
						onPress={() => router.push("/settings/ai-insights")}
						subtitle="Insight preferences"
						title="AI & Insights"
					/>
					<SettingsRow
						disabled
						icon="shield-checkmark-outline"
						iconBackground="#F7F8FC"
						iconColor="#64748B"
						subtitle="Export and privacy controls"
						title="Data & Privacy"
					/>
					<SettingsRow
						icon="information-circle-outline"
						iconBackground="#F7F8FC"
						iconColor="#64748B"
						onPress={() => router.push("/settings/about")}
						subtitle="Version 1.0.0"
						title="About"
					/>
				</SettingsGroup>
				<Pressable
					accessibilityRole="button"
					onPress={handleSignOut}
					style={({ pressed }) => [
						styles.signOutButton,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.signOutText}>Sign Out</Text>
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		signOutButton: {
			alignItems: "center",
			backgroundColor: themeColors.surface,
			borderColor: themeColors.error,
			borderRadius: 16,
			borderWidth: 1,
			justifyContent: "center",
			minHeight: 52,
		},
		signOutText: {
			...typography.label,
			color: themeColors.error,
		},
		pressed: {
			opacity: 0.72,
		},
	});
}
