import {
	getInsightAnalysis,
	getInsightSummary,
	type DailyRoutineConcernLevel,
	type DailyRoutineInsight,
} from "@/services/api/ai";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

type RoutineAIInsightProps = {
	date: string;
	insight?: DailyRoutineInsight;
	onGenerate: (date: string) => Promise<void>;
};

function useThemeStyles() {
	const { themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { styles, themeColors };
}

export function RoutineAIInsight({
	date,
	insight,
	onGenerate,
}: RoutineAIInsightProps) {
	const { themeColors, styles } = useThemeStyles();
	const [modalMode, setModalMode] = useState<"disclaimer" | "analysis" | null>(
		null,
	);
	const [isGenerating, setIsGenerating] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [showOutdatedHelp, setShowOutdatedHelp] = useState(false);
	const summary = getInsightSummary(insight);
	const analysis = getInsightAnalysis(insight);
	const concern = getConcernInfo(insight?.concernLevel ?? "low");
	const statusMessage = getInsightStatusMessage(insight);

	const generateInsight = async () => {
		setIsGenerating(true);
		setErrorMessage(null);

		try {
			await onGenerate(date);
			setModalMode("analysis");
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Could not generate insight.",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	if (!insight) {
		return (
			<>
				<Pressable
					accessibilityRole="button"
					onPress={() => setModalMode("disclaimer")}
					style={styles.card}
				>
					<View style={styles.header}>
						<Ionicons color={themeColors.primary} name="sparkles" size={22} />
						<Text style={styles.title}>AI Daily Insight</Text>
					</View>
					<Text style={styles.body}>
						Generate a gentle summary from this day's logs.
					</Text>
					<Text style={styles.actionText}>Generate AI Insight</Text>
				</Pressable>
				<InsightModal
					visible={modalMode === "disclaimer"}
					onClose={() => setModalMode(null)}
					isCloseDisabled={isGenerating}
				>
					<View style={styles.modalIcon}>
						<Ionicons color={themeColors.primary} name="sparkles" size={24} />
					</View>
					<Text style={styles.modalTitle}>Generate AI Insight</Text>
					<View style={styles.disclaimerList}>
						<DisclaimerText text="AI insights are most accurate with complete logs." />
						<DisclaimerText text="Milo reviews up to the past 7 days of structured routine logs." />
						<DisclaimerText text="AI insight is for assistance only and is not medical guidance." />
					</View>
					{errorMessage ? (
						<Text style={styles.errorText}>{errorMessage}</Text>
					) : null}
					<Pressable
						accessibilityRole="button"
						disabled={isGenerating}
						onPress={() => void generateInsight()}
						style={[
							styles.primaryButton,
							isGenerating && styles.disabledButton,
						]}
					>
						{isGenerating ? (
							<ActivityIndicator color={themeColors.surface} size="small" />
						) : (
							<Text style={styles.primaryButtonText}>Generate</Text>
						)}
					</Pressable>
				</InsightModal>
			</>
		);
	}

	return (
		<>
			<View style={styles.card}>
				<View style={styles.header}>
					<Ionicons color={themeColors.primary} name="sparkles" size={22} />
					<Text style={styles.title}>AI Daily Insight</Text>
				</View>
				<Text numberOfLines={4} style={styles.body}>
					{summary || "Milo generated an insight for this day."}
				</Text>
				<View style={styles.cardActions}>
					<Pressable
						accessibilityRole="button"
						onPress={() => setModalMode("analysis")}
						style={styles.secondaryButton}
					>
						<Text style={styles.secondaryButtonText}>View Full Analysis</Text>
					</Pressable>
				</View>
			</View>
			<InsightModal
				visible={modalMode === "analysis"}
				onClose={() => setModalMode(null)}
				isCloseDisabled={isGenerating}
			>
				<View style={styles.modalHeader}>
					<Text style={styles.modalTitle}>Full Insight</Text>
				</View>
				<View style={styles.statusRow}>
					<Ionicons color={concern.color} name={concern.icon} size={17} />
					<Text style={styles.statusMessage}>{statusMessage}</Text>
				</View>
				<ScrollView style={styles.analysisScroll}>
					<Text style={styles.modalText}>{analysis}</Text>
				</ScrollView>
				{errorMessage ? (
					<Text style={styles.errorText}>{errorMessage}</Text>
				) : null}
				<View style={styles.insightFooter}>
					<Text style={styles.generatedText}>
						Generated {new Date(insight.generatedAt).toLocaleString()}
					</Text>
					{!insight.isCurrentPrompt ? (
						<View style={styles.outdatedSection}>
							<Pressable
								accessibilityRole="button"
								onPress={() => setShowOutdatedHelp((current) => !current)}
								style={styles.outdatedPill}
							>
								<Ionicons
									color={themeColors.primary}
									name="information-circle"
									size={15}
								/>
								<Text style={styles.outdatedText}>
									Generated with outdated AI
								</Text>
							</Pressable>
							<Pressable
								accessibilityLabel="Rerun AI insight"
								accessibilityRole="button"
								disabled={isGenerating}
								onPress={() => void generateInsight()}
								style={styles.iconButton}
							>
								{isGenerating ? (
									<ActivityIndicator color={themeColors.primary} size="small" />
								) : (
									<Ionicons
										color={themeColors.primary}
										name="refresh"
										size={18}
									/>
								)}
							</Pressable>
						</View>
					) : null}
				</View>
				{showOutdatedHelp && !insight.isCurrentPrompt ? (
					<Text style={styles.helperText}>
						A newer Milo AI prompt is available. Rerun to refresh this day with
						the current prompt.
					</Text>
				) : null}
			</InsightModal>
		</>
	);
}

function InsightModal({
	children,
	isCloseDisabled = false,
	onClose,
	visible,
}: {
	children: ReactNode;
	isCloseDisabled?: boolean;
	onClose: () => void;
	visible: boolean;
}) {
	const { styles } = useThemeStyles();

	return (
		<Modal
			animationType="fade"
			onRequestClose={isCloseDisabled ? undefined : onClose}
			transparent
			visible={visible}
		>
			<View style={styles.backdrop}>
				<Pressable
					accessibilityRole="button"
					disabled={isCloseDisabled}
					onPress={onClose}
					style={StyleSheet.absoluteFill}
				/>
				<View style={styles.modalCard}>
					<Pressable
						accessibilityLabel="Close"
						accessibilityRole="button"
						disabled={isCloseDisabled}
						onPress={onClose}
						style={[
							styles.closeIconButton,
							isCloseDisabled && styles.disabledButton,
						]}
					>
						<Ionicons name="close" size={20} style={styles.closeIcon} />
					</Pressable>
					{children}
				</View>
			</View>
		</Modal>
	);
}

export function DisclaimerText({ text }: { text: string }) {
	const { styles, themeColors } = useThemeStyles();

	return (
		<View style={styles.disclaimerRow}>
			<Ionicons color={themeColors.primary} name="checkmark-circle" size={18} />
			<Text style={styles.modalText}>{text}</Text>
		</View>
	);
}

function getConcernInfo(level: DailyRoutineConcernLevel) {
	if (level === "high") {
		return {
			backgroundColor: "#FEE2E2",
			color: "#B91C1C",
			icon: "warning" as const,
		};
	}

	if (level === "watch") {
		return {
			backgroundColor: "#FEF3C7",
			color: "#B45309",
			icon: "alert-circle" as const,
		};
	}

	return {
		backgroundColor: "#DCFCE7",
		color: "#15803D",
		icon: "checkmark-circle" as const,
	};
}

function getInsightStatusMessage(insight?: DailyRoutineInsight) {
	const concernLevel =
		insight?.json.concern_level ?? insight?.concernLevel ?? "low";
	const confidence = insight?.json.confidence ?? "high";

	if (confidence === "low") {
		return "Limited confidence: complete logs would make this insight more reliable.";
	}

	if (concernLevel === "high") {
		return confidence === "high"
			? "Notable change: closer monitoring is advised."
			: "Possible concern: add more complete logs and keep an eye on the pattern.";
	}

	if (concernLevel === "watch") {
		return confidence === "high"
			? "Worth watching: this pattern may need a little attention."
			: "Worth a gentle check: more complete logs will help clarify the pattern.";
	}

	return confidence === "high"
		? "Looking great: today fits the recent routine."
		: "Looks reassuring overall, with room for more complete logs.";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		actionText: {
			...typography.label,
			color: themeColors.primary,
		},
		analysisScroll: {
			alignSelf: "stretch",
			maxHeight: 260,
		},
		backdrop: {
			alignItems: "center",
			backgroundColor: "rgba(21, 24, 39, 0.35)",
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
		},
		body: {
			...typography.body,
			color: themeColors.textPrimary,
			lineHeight: 22,
		},
		card: {
			backgroundColor: themeColors.secondary,
			borderColor: themeColors.border,
			borderRadius: 14,
			borderWidth: 1,
			gap: spacing.sm,
			marginTop: spacing.md,
			padding: spacing.md,
		},
		cardActions: {
			alignItems: "flex-start",
		},
		closeIcon: {
			color: themeColors.primary,
		},
		closeIconButton: {
			alignItems: "center",
			backgroundColor: themeColors.surface,
			borderColor: themeColors.border,
			borderRadius: 999,
			borderWidth: 1,
			height: 34,
			justifyContent: "center",
			position: "absolute",
			right: spacing.md,
			top: spacing.md,
			width: 34,
			zIndex: 2,
		},
		disabledButton: {
			opacity: 0.6,
		},
		disclaimerList: {
			alignSelf: "stretch",
			gap: spacing.sm,
			paddingRight: spacing.sm,
		},
		disclaimerRow: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.sm,
		},
		errorText: {
			color: themeColors.error,
			fontSize: 13,
			fontWeight: "700",
			textAlign: "center",
		},
		generatedText: {
			color: themeColors.textSecondary,
			fontSize: 12,
			fontWeight: "600",
			marginTop: spacing.md,
			alignSelf: "flex-end",
		},
		header: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
		},
		helperText: {
			color: themeColors.textSecondary,
			fontSize: 12,
			lineHeight: 18,
			textAlign: "right",
		},
		insightFooter: {
			alignItems: "flex-end",
			alignSelf: "stretch",
			gap: spacing.xs,
		},
		iconButton: {
			alignItems: "center",
			height: 26,
			justifyContent: "center",
			width: 26,
		},
		modalCard: {
			alignItems: "center",
			backgroundColor: themeColors.secondary,
			borderColor: themeColors.border,
			borderWidth: 1,
			borderRadius: 18,
			gap: spacing.md,
			maxHeight: "86%",
			padding: spacing.lg,
			paddingTop: spacing.xl,
			width: "100%",
		},
		modalIcon: {
			alignItems: "center",
			backgroundColor: themeColors.secondary,
			borderRadius: 999,
			height: 52,
			justifyContent: "center",
			width: 52,
		},
		modalHeader: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
		},
		modalText: {
			...typography.body,
			color: themeColors.textPrimary,
			lineHeight: 22,
		},
		modalTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		outdatedPill: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.xs,
		},
		outdatedText: {
			color: themeColors.primary,
			fontSize: 11,
			fontWeight: "700",
		},
		outdatedSection: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.xs,
		},
		primaryButton: {
			alignItems: "center",
			alignSelf: "stretch",
			backgroundColor: themeColors.primary,
			borderRadius: 12,
			minHeight: 48,
			justifyContent: "center",
			paddingVertical: spacing.md,
		},
		primaryButtonText: {
			...typography.label,
			color: themeColors.surface,
		},
		secondaryButton: {
			borderColor: themeColors.primary,
			borderRadius: 10,
			borderWidth: 1,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
		},
		secondaryButtonText: {
			color: themeColors.primary,
			fontSize: 13,
			fontWeight: "800",
		},
		statusMessage: {
			color: themeColors.textPrimary,
			flex: 1,
			fontSize: 13,
			fontWeight: "700",
			lineHeight: 19,
		},
		statusRow: {
			alignItems: "flex-start",
			alignSelf: "stretch",
			flexDirection: "row",
			gap: spacing.sm,
		},
		title: {
			...typography.label,
			color: themeColors.primary,
			fontWeight: "800",
		},
	});
}
