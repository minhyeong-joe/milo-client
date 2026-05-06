import { useAuthSession } from "@/context/AuthSessionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
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

export default function SignInScreen() {
	const router = useRouter();
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
							<Ionicons color={colors.light.primary} name="sparkles" size={26} />
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
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				placeholderTextColor={colors.light.textSecondary}
				style={styles.input}
				{...inputProps}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
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
		color: colors.light.textPrimary,
	},
	brandCaption: {
		...typography.body,
		color: colors.light.textSecondary,
	},
	hero: {
		marginBottom: spacing.lg,
	},
	title: {
		...typography.title,
		color: colors.light.textPrimary,
		marginBottom: spacing.sm,
	},
	body: {
		...typography.body,
		color: colors.light.textSecondary,
	},
	formCard: {
		gap: spacing.md,
	},
	field: {
		gap: spacing.xs,
	},
	fieldLabel: {
		...typography.caption,
		color: colors.light.textSecondary,
		textTransform: "uppercase",
	},
	input: {
		...typography.body,
		backgroundColor: colors.light.background,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		color: colors.light.textPrimary,
		minHeight: 50,
		paddingHorizontal: spacing.md,
	},
	primaryButton: {
		alignItems: "center",
		backgroundColor: colors.light.primary,
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
		color: colors.light.surface,
	},
	modeLink: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.sm,
	},
	modeLinkText: {
		...typography.label,
		color: colors.light.primary,
	},
	errorText: {
		...typography.body,
		color: colors.light.error,
		textAlign: "center",
	},
});
