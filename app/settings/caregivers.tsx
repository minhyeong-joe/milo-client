import { PlaceholderCard, SettingsGroup, SettingsHeader, SettingsRow } from "@/components/settings/SettingsRows";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ManageCaregiversScreen() {
	const router = useRouter();
	const { session } = useAuthSession();
	const { selectedBaby } = useBabySelection();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Manage Caregivers" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>{selectedBaby?.name ?? "Baby"} Access</Text>
					<View style={styles.userRow}>
						<View style={styles.initialCircle}>
							<Text style={styles.initialText}>
								{getInitial(session?.user.displayName ?? session?.user.email)}
							</Text>
						</View>
						<View style={styles.userText}>
							<Text style={styles.userName}>
								{session?.user.displayName ?? session?.user.email ?? "Current user"}
							</Text>
							<Text style={styles.userMeta}>
								{session?.user.email ?? "Signed in user"} • {formatRole(selectedBaby?.role)}
							</Text>
						</View>
					</View>
				</View>

				<SettingsGroup>
					<SettingsRow
						disabled
						icon="mail-outline"
						iconBackground="#F1ECFF"
						iconColor={colors.light.primary}
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

const styles = StyleSheet.create({
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
		color: colors.light.primary,
	},
	sectionTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	userMeta: {
		...typography.caption,
		color: colors.light.textSecondary,
		marginTop: 2,
	},
	userName: {
		...typography.label,
		color: colors.light.textPrimary,
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
