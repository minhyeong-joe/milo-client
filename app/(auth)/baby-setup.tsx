import {
	BabyAvatarField,
	BabyBirthdateField,
	BabyNameField,
	BabySexSelector,
	formatBabyProfileDateKey,
} from "@/components/baby/BabyProfileFields";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	acceptBabyInvite,
	createBaby,
	normalizeInviteCode,
	type BabyRole,
	type BabySex,
} from "@/services/api/babies";
import { BABY_NAME_MAX_LENGTH } from "@/services/validation/inputLimits";
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
	const {
		clearError,
		completeSignupWithBaby,
		completeSignupWithInvite,
		error,
		isLoading,
		session,
	} = useAuthSession();
	const { refreshBabies, selectBaby } = useBabySelection();
	const [setupMode, setSetupMode] = useState<SetupMode>("addBaby");
	const [babyName, setBabyName] = useState("");
	const [birthdate, setBirthdate] = useState(() => new Date());
	const [isBirthdatePickerVisible, setIsBirthdatePickerVisible] =
		useState(false);
	const [sex, setSex] = useState<BabySex>("GIRL");
	const [role, setRole] = useState<BabyRole>("MOTHER");
	const [inviteCode, setInviteCode] = useState("");
	const [setupError, setSetupError] = useState<string | null>(null);

	const canContinue = useMemo(() => {
		if (setupMode === "inviteCode") {
			return normalizeInviteCode(inviteCode).length === 8;
		}

		const trimmedName = babyName.trim();
		return trimmedName.length > 0 && trimmedName.length <= BABY_NAME_MAX_LENGTH;
	}, [babyName, inviteCode, setupMode]);

	const continueToHome = async () => {
		if (setupMode === "inviteCode") {
			await continueWithInvite();
			return;
		}

		await continueWithNewBaby();
	};

	const continueWithNewBaby = async () => {
		const trimmedName = babyName.trim();

		if (!trimmedName) {
			setSetupError("Baby name is required.");
			return;
		}

		if (trimmedName.length > BABY_NAME_MAX_LENGTH) {
			setSetupError(
				`Baby name must be ${BABY_NAME_MAX_LENGTH} characters or fewer.`,
			);
			return;
		}

		setSetupError(null);

		if (session) {
			try {
				const response = await createBaby({
					birthdate: formatBabyProfileDateKey(birthdate),
					name: trimmedName,
					role,
					sex,
				});
				await refreshBabies();
				selectBaby(response.baby.id);
				router.replace("/home");
			} catch (caughtError) {
				setSetupError(getSetupErrorMessage(caughtError));
			}
			return;
		}

		const isComplete = await completeSignupWithBaby({
			birthdate: formatBabyProfileDateKey(birthdate),
			name: trimmedName,
			role,
			sex,
		});

		if (isComplete) {
			router.replace("/home");
		}
	};

	const continueWithInvite = async () => {
		const normalizedInviteCode = normalizeInviteCode(inviteCode);

		if (normalizedInviteCode.length !== 8) {
			setSetupError("Enter the 8-character invite code.");
			return;
		}

		setSetupError(null);

		if (session) {
			try {
				const response = await acceptBabyInvite({
					inviteCode: normalizedInviteCode,
					role,
				});
				await refreshBabies();
				selectBaby(response.access.babyId);
				router.replace("/home");
			} catch (caughtError) {
				setSetupError(getSetupErrorMessage(caughtError));
			}
			return;
		}

		const isComplete = await completeSignupWithInvite({
			inviteCode: normalizedInviteCode,
			role,
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
							Milo works around a baby profile, so finish setup with a new baby
							or an invitation code.
						</Text>
					</View>

					<View style={styles.choiceGrid}>
						<SetupChoice
							active={setupMode === "addBaby"}
							icon="person-add"
							label="Add Baby"
							onPress={() => {
								clearError();
								setSetupError(null);
								setSetupMode("addBaby");
							}}
						/>
						<SetupChoice
							active={setupMode === "inviteCode"}
							icon="key"
							label="Invite Code"
							onPress={() => {
								clearError();
								setSetupError(null);
								setSetupMode("inviteCode");
							}}
						/>
					</View>

					<View
						style={[
							globalStyles.card,
							globalStyles.shadowCard,
							styles.formCard,
						]}
					>
						{setupMode === "addBaby" ? (
							<>
								<BabyAvatarField />
								<BabyNameField
									maxLength={BABY_NAME_MAX_LENGTH}
									onChangeText={(value) => {
										setBabyName(value);
										setSetupError(null);
									}}
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
									maxLength={8}
									onChangeText={(value) => {
										setInviteCode(normalizeInviteCode(value));
										setSetupError(null);
									}}
									placeholder="XXXXXXXX"
									value={inviteCode}
								/>
								<RoleSelector role={role} onChange={setRole} />
								<Text style={styles.helpText}>
									Choose your role for this baby, then join with the invite
									code.
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
								{isLoading ? "Working..." : "Continue to Home"}
							</Text>
						</Pressable>

						{(setupError || error) && (
							<Text style={styles.errorText}>{setupError ?? error}</Text>
						)}
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
			<Text style={[styles.choiceText, active && styles.choiceTextActive]}>
				{label}
			</Text>
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
				<RoleButton
					active={role === "FATHER"}
					label="Father"
					onPress={() => onChange("FATHER")}
				/>
				<RoleButton
					active={role === "MOTHER"}
					label="Mother"
					onPress={() => onChange("MOTHER")}
				/>
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
			<Text style={[styles.roleText, active && styles.roleTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

function getSetupErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
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
