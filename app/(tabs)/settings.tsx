import { BabySelectorModal } from "@/components/baby/BabySelectorModal";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";
import { useBabySelection } from "@/context/BabySelectionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const fallbackBabyAvatar = require("@/assets/images/baby.png");

export default function SettingsScreen() {
	const router = useRouter();
	const { babies, selectBaby, selectedBaby } = useBabySelection();
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={globalStyles.sectionTitleText}>Settings</Text>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Select baby"
					onPress={() => setIsSelectorOpen(true)}
					style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
				>
					<Image
						source={selectedBaby?.avatarUrl ? { uri: selectedBaby.avatarUrl } : fallbackBabyAvatar}
						style={styles.avatar}
					/>
					<View style={styles.profileText}>
						<Text style={styles.babyName}>{selectedBaby?.name ?? "Baby Profile"}</Text>
						<Text style={styles.profileSubtitle}>
							{selectedBaby
								? `Born ${formatBirthdate(selectedBaby.birthdate, selectedBaby.timezone)}\n${formatAge(selectedBaby.birthdate)} old`
								: "Create or choose a baby profile"}
						</Text>
					</View>
					<Ionicons color={colors.light.textSecondary} name="chevron-down" size={22} />
				</Pressable>

				<SettingsGroup>
					<SettingsRow
						icon="create-outline"
						iconBackground="#F1ECFF"
						iconColor={colors.light.primary}
						onPress={() => router.push("/baby/edit-profile")}
						subtitle="Name, birthday, photo"
						title="Edit Baby Profile"
					/>
					<SettingsRow
						icon="people-outline"
						iconBackground="#EAF8EF"
						iconColor="#2FAE62"
						onPress={() => router.push("/settings/caregivers")}
						subtitle="Access and invitations"
						title="Manage Caregivers"
					/>
					<SettingsRow
						icon="analytics-outline"
						iconBackground="#EAF8EF"
						iconColor="#2FAE62"
						onPress={() => router.push("/baby/growth")}
						subtitle="Height, Weight, Head Size"
						title="Growth Records"
					/>
					<SettingsRow
						icon="pricetag-outline"
						iconBackground="#FFEAF4"
						iconColor="#D84D8B"
						onPress={() => router.push("/settings/tags")}
						subtitle="Manage milestone tags"
						title="Milestone Tags"
					/>
				</SettingsGroup>

				<SettingsGroup>
					<SettingsRow
						icon="settings-outline"
						onPress={() => router.push("/settings/preferences")}
						subtitle="Units, Language, Theme"
						title="App Preferences"
					/>
					<SettingsRow
						icon="sparkles-outline"
						onPress={() => router.push("/settings/ai-insights")}
						subtitle="Insight settings and daily summary"
						title="AI & Insights"
					/>
					<SettingsRow
						icon="person-outline"
						onPress={() => router.push("/settings/account")}
						subtitle="Email, Password, Security"
						title="Account"
					/>
					<SettingsRow
						icon="cloud-upload-outline"
						onPress={() => router.push("/settings/backup-export")}
						subtitle="Export data and backups"
						title="Backup & Export"
					/>
					<SettingsRow
						icon="information-circle-outline"
						subtitle="Version 1.0.0"
						title="About"
					/>
				</SettingsGroup>
				<BabySelectorModal
					babies={babies}
					onClose={() => setIsSelectorOpen(false)}
					onSelectBaby={selectBaby}
					selectedBaby={selectedBaby}
					visible={isSelectorOpen}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

function formatBirthdate(dateKey: string, timeZone?: string) {
	const date = new Date(`${dateKey}T00:00:00`);
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(date);
}

function formatAge(dateKey: string) {
	const birthdate = new Date(`${dateKey}T00:00:00`);
	const today = new Date();
	let months = (today.getFullYear() - birthdate.getFullYear()) * 12;
	months += today.getMonth() - birthdate.getMonth();

	if (today.getDate() < birthdate.getDate()) {
		months -= 1;
	}

	const monthAnchor = new Date(birthdate);
	monthAnchor.setMonth(birthdate.getMonth() + Math.max(months, 0));
	const days = Math.max(0, Math.floor((today.getTime() - monthAnchor.getTime()) / 86400000));

	if (months <= 0) {
		return `${days} days`;
	}

	return `${months} months • ${days} days`;
}

const styles = StyleSheet.create({
	avatar: {
		backgroundColor: "#D9BFAE",
		borderRadius: 28,
		height: 56,
		width: 56,
	},
	babyName: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	content: {
		gap: spacing.md,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	pressed: {
		opacity: 0.72,
	},
	profileCard: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 16,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.md,
		padding: spacing.md,
	},
	profileSubtitle: {
		...typography.caption,
		color: colors.light.textSecondary,
		lineHeight: 18,
		marginTop: 3,
	},
	profileText: {
		flex: 1,
	},
});
