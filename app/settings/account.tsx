import { SettingsGroup, SettingsHeader, SettingsRow } from "@/components/settings/SettingsRows";
import { useAuthSession } from "@/context/AuthSessionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
	const router = useRouter();
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
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>User Info</Text>
					<InfoRow label="Name" value={user?.displayName ?? "Not set"} />
					<InfoRow label="Email" value={user?.email ?? "Not signed in"} />
				</View>

				<SettingsGroup>
					<SettingsRow
						disabled
						icon="mail-outline"
						title="Update Email"
					/>
					<SettingsRow
						disabled
						icon="lock-closed-outline"
						title="Change Password"
					/>
				</SettingsGroup>
				<Pressable
					accessibilityRole="button"
					onPress={handleSignOut}
					style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
				>
					<Text style={styles.signOutText}>Sign Out</Text>
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.infoRow}>
			<Text style={styles.infoLabel}>{label}</Text>
			<Text style={styles.infoValue}>{value}</Text>
		</View>
	);
}

function formatProvider(provider?: string) {
	if (!provider) {
		return "Not available";
	}

	return provider.charAt(0).toUpperCase() + provider.slice(1);
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	infoLabel: {
		...typography.caption,
		color: colors.light.textSecondary,
		textTransform: "uppercase",
	},
	infoRow: {
		gap: spacing.xs,
		marginTop: spacing.md,
	},
	infoValue: {
		...typography.body,
		color: colors.light.textPrimary,
	},
	sectionTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	signOutButton: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.error,
		borderRadius: 16,
		borderWidth: 1,
		justifyContent: "center",
		minHeight: 52,
	},
	signOutText: {
		...typography.label,
		color: colors.light.error,
	},
	pressed: {
		opacity: 0.72,
	},
});
