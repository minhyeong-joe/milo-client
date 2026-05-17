import { useAuthSession } from "@/context/AuthSessionContext";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
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

type AuthMode = "signIn" | "createAccount";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function SignInScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { clearError, error, isLoading, signIn, startSignupDraft } = useAuthSession();
	const [mode, setMode] = useState<AuthMode>("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const isCreateAccount = mode === "createAccount";
	const canSubmit = useMemo(() => {
		if (isCreateAccount) {
			return (
				displayName.trim().length > 0 &&
				email.trim().length > 0 &&
				password.length >= 8 &&
				confirmPassword.length >= 8
			);
		}

		return email.trim().length > 0 && password.length >= 8;
	}, [confirmPassword, displayName, email, isCreateAccount, password]);

	const submit = async () => {
		if (!canSubmit) {
			return;
		}

		if (isCreateAccount) {
			const isDraftReady = startSignupDraft({
				confirmPassword,
				displayName,
				email,
				password,
			});

			if (isDraftReady) {
				router.push("/baby-setup");
			}

			return;
		}

		const isSignedIn = await signIn(email, password);

		if (isSignedIn) {
			router.replace("/home");
		}
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
					<View style={styles.brandRow}>
						<View style={styles.logo}>
							<Ionicons color={themeColors.primary} name="sparkles" size={26} />
						</View>
						<View>
							<Text style={styles.brandName}>Milo</Text>
							<Text style={styles.brandCaption}>Baby routine, calmer days.</Text>
						</View>
					</View>

					<View style={[globalStyles.card, globalStyles.shadowCard, styles.formCard]}>
						{isCreateAccount && (
							<FormField
								autoCapitalize="words"
								label="Parent name"
								onChangeText={setDisplayName}
								placeholder="Your name"
								value={displayName}
							/>
						)}
						<FormField
							autoCapitalize="none"
							autoComplete="email"
							keyboardType="email-address"
							label="Email"
							onChangeText={setEmail}
							placeholder="parent@example.com"
							value={email}
						/>
						<FormField
							autoCapitalize="none"
							label="Password"
							onChangeText={setPassword}
							placeholder="Password"
							secureTextEntry
							value={password}
						/>
						{isCreateAccount && (
							<FormField
								autoCapitalize="none"
								label="Confirm password"
								onChangeText={setConfirmPassword}
								placeholder="Confirm password"
								secureTextEntry
								value={confirmPassword}
							/>
						)}

						<Pressable
							disabled={!canSubmit || isLoading}
							onPress={submit}
							style={({ pressed }) => [
								styles.primaryButton,
								(!canSubmit || isLoading) && styles.disabledButton,
								pressed && canSubmit && !isLoading && styles.pressedButton,
							]}
						>
							<Text style={styles.primaryButtonText}>
								{isLoading ? "Please wait..." : isCreateAccount ? "Continue" : "Sign In"}
							</Text>
						</Pressable>

						{error && <Text style={styles.errorText}>{error}</Text>}

						<Pressable
							onPress={() => {
								clearError();
								setMode(isCreateAccount ? "signIn" : "createAccount");
							}}
							style={({ pressed }) => [styles.modeLink, pressed && styles.pressedButton]}
						>
							<Text style={styles.modeLinkText}>
								{isCreateAccount ? "Back to Sign in" : "Create new account"}
							</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
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
	brandRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		marginBottom: spacing.xl,
	},
	logo: {
		alignItems: "center",
		backgroundColor: "#F0EBFF",
		borderRadius: 18,
		height: 54,
		justifyContent: "center",
		width: 54,
	},
	brandName: {
		...typography.screenTitle,
		color: themeColors.textPrimary,
	},
	brandCaption: {
		...typography.body,
		color: themeColors.textSecondary,
	},
	hero: {
		marginBottom: spacing.lg,
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
	modeLink: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.sm,
	},
	modeLinkText: {
		...typography.label,
		color: themeColors.primary,
	},
	errorText: {
		...typography.body,
		color: themeColors.error,
		textAlign: "center",
	},
});
}
