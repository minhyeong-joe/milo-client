import { useMemo } from "react";
import { PlaceholderCard, SettingsGroup, SettingsHeader, SettingsRow } from "@/components/settings/SettingsRows";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function ManageCaregiversScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { session } = useAuthSession();
	const { selectedBaby } = useBabySelection();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Manage Caregivers" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Access to {selectedBaby?.name ?? "Baby"}</Text>
					<View style={styles.userRow}>
						<View style={styles.initialCircle}>
							<Text style={styles.initialText}>
								{getInitial(session?.user.displayName ?? session?.user.email)}
							</Text>
						</View>
						<View style={styles.userText}>
							<Text style={styles.userName}>
								{session?.user.displayName ?? session?.user.email ?? "Current user"}  • {formatRole(selectedBaby?.role)}
							</Text>
							<Text style={styles.userMeta}>
								{session?.user.email ?? "Signed in user"}
							</Text>
						</View>
					</View>
				</View>

				<SettingsGroup>
					<SettingsRow
						disabled
						icon="mail-outline"
						iconBackground="#F1ECFF"
						iconColor={themeColors.primary}
						subtitle="Invite by email"
						title="Send Invitation"
					/>
				</SettingsGroup>

				<PlaceholderCard
					icon="people-outline"
					message="Caregiver invitations and access management"
					title="Invitation tools coming soon"
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

function getInitial(value?: string | null) {
	return value?.trim().charAt(0).toUpperCase() || "?";
}

function formatRole(role?: string) {
	if (!role) {
		return "Role unavailable";
	}

	return role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	content: {
		gap: spacing.md,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	initialCircle: {
		alignItems: "center",
		backgroundColor: "#F1ECFF",
		borderRadius: 24,
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	initialText: {
		...typography.label,
		color: themeColors.primary,
	},
	sectionTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	userMeta: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
	userName: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	userRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		marginTop: spacing.md,
	},
	userText: {
		flex: 1,
	},
});
}
