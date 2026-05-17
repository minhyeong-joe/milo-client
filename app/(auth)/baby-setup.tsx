import {
	BabyAvatarField,
	BabyBirthdateField,
	BabyNameField,
	BabySexSelector,
	formatBabyProfileDateKey,
} from "@/components/baby/BabyProfileFields";
import { useAuthSession } from "@/context/AuthSessionContext";
import type { BabyRole, BabySex } from "@/services/api/babies";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SetupMode = "addBaby" | "inviteCode";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function BabySetupScreen() {
	const router = useRouter();
	const { globalStyles, styles } = useThemeStyles();
	const { clearError, completeSignupWithBaby, error, isLoading } = useAuthSession();
	const [setupMode, setSetupMode] = useState<SetupMode>("addBaby");
	const [babyName, setBabyName] = useState("");
	const [birthdate, setBirthdate] = useState(() => new Date());
	const [isBirthdatePickerVisible, setIsBirthdatePickerVisible] = useState(false);
	const [sex, setSex] = useState<BabySex>("GIRL");
	const [role, setRole] = useState<BabyRole>("MOTHER");
	const [inviteCode, setInviteCode] = useState("");

	const canContinue = useMemo(() => {
		if (setupMode === "inviteCode") {
			return false;
		}

		return babyName.trim().length > 0;
	}, [babyName, setupMode]);

	const continueToHome = async () => {
		if (!canContinue) {
			return;
		}

		const isComplete = await completeSignupWithBaby({
			birthdate: formatBabyProfileDateKey(birthdate),
			name: babyName,
			role,
			sex,
		});

		if (isComplete) {
			router.replace("/home");
		}
	};

	const handleBirthdateChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") {
			setIsBirthdatePickerVisible(false);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setBirthdate(selectedDate);
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.header}>
						<Text style={styles.title}>Add your baby</Text>
						<Text style={styles.body}>
							Milo works around a baby profile, so finish setup with a new baby or an invitation code.
						</Text>
					</View>

					<View style={styles.choiceGrid}>
						<SetupChoice
							active={setupMode === "addBaby"}
							icon="person-add"
							label="Add Baby"
							onPress={() => {
								clearError();
								setSetupMode("addBaby");
							}}
						/>
						<SetupChoice
							active={setupMode === "inviteCode"}
							icon="key"
							label="Invite Code"
							onPress={() => {
								clearError();
								setSetupMode("inviteCode");
							}}
						/>
					</View>

					<View style={[globalStyles.card, globalStyles.shadowCard, styles.formCard]}>
						{setupMode === "addBaby" ? (
							<>
								<BabyAvatarField />
								<BabyNameField
									onChangeText={setBabyName}
									placeholder="Emma"
									value={babyName}
								/>
								<BabyBirthdateField
									isPickerVisible={isBirthdatePickerVisible}
									label="Birth Date"
									onChange={handleBirthdateChange}
									onOpenPicker={() => setIsBirthdatePickerVisible(true)}
									value={birthdate}
								/>
								<BabySexSelector onChange={setSex} value={sex} />
								<RoleSelector role={role} onChange={setRole} />
							</>
						) : (
							<>
								<FormField
									autoCapitalize="characters"
									label="Invitation code"
									onChangeText={setInviteCode}
									placeholder="ABCD-1234"
									value={inviteCode}
								/>
								<RoleSelector role={role} onChange={setRole} />
								<Text style={styles.helpText}>
									Invite access is coming later. Add a baby to continue for now.
								</Text>
							</>
						)}

						<Pressable
							disabled={!canContinue || isLoading}
							onPress={continueToHome}
							style={({ pressed }) => [
								styles.primaryButton,
								(!canContinue || isLoading) && styles.disabledButton,
								pressed && canContinue && !isLoading && styles.pressedButton,
							]}
						>
							<Text style={styles.primaryButtonText}>
								{isLoading ? "Creating account..." : "Continue to Home"}
							</Text>
						</Pressable>

						{error && <Text style={styles.errorText}>{error}</Text>}
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function SetupChoice({
	active,
	icon,
	label,
	onPress,
}: {
	active: boolean;
	icon: ComponentProps<typeof Ionicons>["name"];
	label: string;
	onPress: () => void;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.choice,
				active && styles.choiceActive,
				pressed && styles.pressedButton,
			]}
		>
			<Ionicons
				color={active ? themeColors.primary : themeColors.textSecondary}
				name={icon}
				size={22}
			/>
			<Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
		</Pressable>
	);
}

function FormField({
	label,
	...inputProps
}: {
	label: string;
} & ComponentProps<typeof TextInput>) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				placeholderTextColor={themeColors.textSecondary}
				style={styles.input}
				{...inputProps}
			/>
		</View>
	);
}

function RoleSelector({
	onChange,
	role,
}: {
	onChange: (role: BabyRole) => void;
	role: BabyRole;
}) {
	const { styles } = useThemeStyles();
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>I am a</Text>
			<View style={styles.roleRow}>
				<RoleButton active={role === "FATHER"} label="Father" onPress={() => onChange("FATHER")} />
				<RoleButton active={role === "MOTHER"} label="Mother" onPress={() => onChange("MOTHER")} />
				<RoleButton
					active={role === "CAREGIVER"}
					label="Caregiver"
					onPress={() => onChange("CAREGIVER")}
				/>
			</View>
		</View>
	);
}

function RoleButton({
	active,
	label,
	onPress,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	const { styles } = useThemeStyles();
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.roleButton,
				active && styles.roleButtonActive,
				pressed && styles.pressedButton,
			]}
		>
			<Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
		</Pressable>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	keyboardView: {
		flex: 1,
	},
	content: {
		flexGrow: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	header: {
		marginBottom: spacing.xl,
	},
	iconCircle: {
		alignItems: "center",
		backgroundColor: "#F0EBFF",
		borderRadius: 18,
		height: 54,
		justifyContent: "center",
		marginBottom: spacing.md,
		width: 54,
	},
	title: {
		...typography.title,
		color: themeColors.textPrimary,
		marginBottom: spacing.sm,
	},
	body: {
		...typography.body,
		color: themeColors.textSecondary,
	},
	choiceGrid: {
		flexDirection: "row",
		gap: spacing.md,
		marginBottom: spacing.md,
	},
	choice: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 16,
		borderWidth: 1,
		flex: 1,
		gap: spacing.sm,
		padding: spacing.md,
	},
	choiceActive: {
		backgroundColor: "#F7F3FF",
		borderColor: themeColors.primary,
	},
	choiceText: {
		...typography.label,
		color: themeColors.textSecondary,
	},
	choiceTextActive: {
		color: themeColors.primary,
	},
	formCard: {
		gap: spacing.md,
	},
	field: {
		gap: spacing.xs,
	},
	fieldLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
		textTransform: "uppercase",
	},
	input: {
		...typography.body,
		backgroundColor: themeColors.background,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		color: themeColors.textPrimary,
		minHeight: 50,
		paddingHorizontal: spacing.md,
	},
	roleRow: {
		backgroundColor: themeColors.background,
		borderRadius: 14,
		flexDirection: "row",
		gap: spacing.xs,
		padding: spacing.xs,
	},
	roleButton: {
		alignItems: "center",
		borderRadius: 11,
		flex: 1,
		justifyContent: "center",
		minHeight: 42,
		paddingHorizontal: spacing.xs,
	},
	roleButtonActive: {
		backgroundColor: themeColors.surface,
	},
	roleText: {
		...typography.caption,
		color: themeColors.textSecondary,
		textAlign: "center",
	},
	roleTextActive: {
		color: themeColors.primary,
	},
	primaryButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 16,
		justifyContent: "center",
		marginTop: spacing.xs,
		minHeight: 52,
	},
	disabledButton: {
		opacity: 0.45,
	},
	pressedButton: {
		opacity: 0.75,
	},
	primaryButtonText: {
		...typography.label,
		color: themeColors.surface,
	},
	helpText: {
		...typography.body,
		color: themeColors.textSecondary,
	},
	errorText: {
		...typography.body,
		color: themeColors.error,
		textAlign: "center",
	},
});
}
