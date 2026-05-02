import type { BabyProfile } from "@/data/homeData";
import { colors, spacing, globalStyles } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, Image } from "react-native";

function BabyAvatar() {
	// TODO: return profile image if uploaded
	return (
		<Image source={require("@/assets/images/baby.png")} style={styles.avatar} />
	);
}

export function BabyHeader({
	ageLabel,
	baby,
}: {
	ageLabel: string;
	baby: BabyProfile;
}) {
	return (
		<View style={[globalStyles.rowBetween, styles.header]}>
			<View style={[globalStyles.rowCenter, styles.profileRow]}>
				<BabyAvatar />
				<View>
					<View style={[globalStyles.rowCenter, styles.nameRow]}>
						<Text style={styles.babyName}>{baby.name}</Text>
						<Ionicons
							color={colors.light.textPrimary}
							name="chevron-down"
							size={18}
						/>
					</View>
					<Text style={styles.babyAge}>{ageLabel}</Text>
				</View>
			</View>
			<View style={[globalStyles.rowCenter, styles.headerActions]}>
				<Ionicons
					color={colors.light.textPrimary}
					name="notifications-outline"
					size={25}
				/>
				<Ionicons
					color={colors.light.textPrimary}
					name="calendar-outline"
					size={25}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	avatar: {
		alignItems: "center",
		backgroundColor: "#D9BFAE",
		borderRadius: 28,
		height: 56,
		justifyContent: "center",
		overflow: "hidden",
		width: 56,
	},
	babyAge: {
		color: colors.light.textSecondary,
		fontSize: 15,
		fontWeight: "600",
		marginTop: 2,
	},
	babyName: {
		color: colors.light.textPrimary,
		fontSize: 24,
		fontWeight: "800",
	},
	header: {
		marginBottom: spacing.md,
	},
	headerActions: {
		gap: spacing.lg,
	},
	nameRow: {
		gap: spacing.xs,
	},
	profileRow: {
		gap: spacing.md,
	},
});
