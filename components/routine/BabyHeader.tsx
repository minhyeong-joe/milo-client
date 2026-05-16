import { BabySelectorAvatar, BabySelectorModal } from "@/components/baby/BabySelectorModal";
import type { BabyListItem } from "@/services/api/babies";
import { colors, spacing, globalStyles } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

export function BabyHeader({
	ageLabel,
	babies,
	baby,
	onSelectBaby,
}: {
	ageLabel: string;
	babies: BabyListItem[];
	baby: BabyListItem;
	onSelectBaby: (babyId: string) => void;
}) {
	const router = useRouter();
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);

	return (
		<View style={[globalStyles.rowBetween, styles.header]}>
			<View style={[globalStyles.rowCenter, styles.profileRow]}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Open baby profile actions"
					onPress={() => {
						router.push("/baby/edit-profile");
					}}
				>
					<BabySelectorAvatar baby={baby} />
				</Pressable>
				<View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Select baby"
						onPress={() => setIsSelectorOpen(true)}
					>
						<View style={[globalStyles.rowCenter, styles.nameRow]}>
							<Text style={styles.babyName}>{baby.name}</Text>
							<Ionicons
								color={colors.light.textPrimary}
								name="chevron-down"
								size={18}
							/>
						</View>
						<Text style={styles.babyAge}>{ageLabel}</Text>
					</Pressable>
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
			<BabySelectorModal
				babies={babies}
				onClose={() => setIsSelectorOpen(false)}
				onSelectBaby={onSelectBaby}
				selectedBaby={baby}
				visible={isSelectorOpen}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
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
