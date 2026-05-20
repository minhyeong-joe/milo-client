import { useAppTheme } from "@/context/AppPreferencesContext";
import {
	getDiaryReflection,
	getDiaryReflectionStatus,
	type DiaryReflectionInputSnapshot,
	type DiaryReflectionStatusResponse,
} from "@/services/api/diary";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

type DiaryReflectionCardProps = {
	babyId: string;
	diaryId: string;
	isOnline: boolean;
	language: string;
	onBusyChange?: (isBusy: boolean) => void;
	timeZone?: string;
};

export function DiaryReflectionCard({
	babyId,
	diaryId,
	isOnline,
	language,
	onBusyChange,
	timeZone,
}: DiaryReflectionCardProps) {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);
	const [status, setStatus] = useState<DiaryReflectionStatusResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSnapshotExpanded, setIsSnapshotExpanded] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		onBusyChange?.(isGenerating);

		return () => {
			onBusyChange?.(false);
		};
	}, [isGenerating, onBusyChange]);

	useEffect(() => {
		let isActive = true;

		if (!isOnline) {
			setStatus(null);
			setIsLoading(false);
			setErrorMessage(null);
			return () => {
				isActive = false;
			};
		}

		setIsLoading(true);
		setErrorMessage(null);

		getDiaryReflectionStatus({ babyId, diaryId })
			.then((nextStatus) => {
				if (isActive) {
					setStatus(nextStatus);
				}
			})
			.catch((error) => {
				console.warn(error);

				if (isActive) {
					setErrorMessage("AI reflection is unavailable right now.");
				}
			})
			.finally(() => {
				if (isActive) {
					setIsLoading(false);
				}
			});

		return () => {
			isActive = false;
		};
	}, [babyId, diaryId, isOnline]);

	const generateReflection = async () => {
		if (!isOnline || isGenerating) {
			return;
		}

		setIsGenerating(true);
		setErrorMessage(null);

		try {
			const response = await getDiaryReflection({ babyId, diaryId, language });
			setStatus(response);
			setIsSnapshotExpanded(false);
		} catch (error) {
			console.warn(error);
			setErrorMessage(
				"AI reflection could not be generated. Please try again.",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const reflection = status?.reflection ?? null;
	const output = reflection?.json ?? null;
	const hasReflection = Boolean(reflection && output);

	return (
		<View style={[globalStyles.card, styles.card]}>
			<View style={styles.headerRow}>
				<View style={styles.headerTitleRow}>
					<Ionicons color={themeColors.primary} name="sparkles" size={20} />
					<Text style={styles.label}>AI Reflection</Text>
				</View>
				{isLoading ? (
					<ActivityIndicator color={themeColors.primary} size="small" />
				) : null}
			</View>

			{!isOnline ? (
				<Text style={styles.bodyText}>
					Reconnect to generate or view AI reflections for diary entries.
				</Text>
			) : isLoading ? (
				<View style={styles.loadingRow}>
					<ActivityIndicator color={themeColors.primary} size="small" />
					<Text style={styles.bodyText}>Checking for an AI reflection...</Text>
				</View>
			) : hasReflection && output ? (
				<>
					<Text style={styles.headline}>{output.headline}</Text>
					<Text style={styles.bodyText}>{output.reflection}</Text>
					<ReflectionSection
						iconName="bulb"
						label="Gentle guide"
						text={output.encouragement}
					/>
					{output.milestone_context ? (
						<ReflectionSection
							iconName="trophy"
							label="Good job"
							text={output.milestone_context}
						/>
					) : null}
					{status?.contentModifiedAfterReflection ? (
						<SnapshotNotice
							expanded={isSnapshotExpanded}
							onToggle={() => setIsSnapshotExpanded((current) => !current)}
							snapshot={status.inputSnapshot}
						/>
					) : null}
					<View style={styles.footerRow}>
						<View style={styles.footerMeta}>
							<Text style={styles.generatedText}>
								Generated{" "}
								{formatGeneratedDate(
									reflection!.generatedAt,
									timeZone,
									language,
								)}
							</Text>
							{!reflection!.isCurrentPrompt ? (
								<View style={styles.outdatedRow}>
									<Ionicons
										color={themeColors.primary}
										name="information-circle-outline"
										size={13}
									/>
									<Text style={styles.outdatedText}>
										Generated with outdated model
									</Text>
								</View>
							) : null}
						</View>
						{!reflection!.isCurrentPrompt ? (
							<Pressable
								accessibilityLabel="Regenerate diary reflection"
								disabled={isGenerating}
								hitSlop={10}
								onPress={() => void generateReflection()}
								style={styles.rerunButton}
							>
								{isGenerating ? (
									<ActivityIndicator color={themeColors.primary} size="small" />
								) : (
									<Ionicons
										color={themeColors.primary}
										name="refresh"
										size={20}
									/>
								)}
							</Pressable>
						) : null}
					</View>
				</>
			) : (
				<>
					<Text style={styles.bodyText}>
						Generate a gentle reflection from this diary entry.
					</Text>
					<View style={styles.disclaimerBox}>
						<DisclaimerText text="AI reflections are not medical guidance." />
						<DisclaimerText text="If the entry changes later, Milo will show what the reflection was based on." />
					</View>
					<Pressable
						accessibilityRole="button"
						disabled={isLoading || isGenerating}
						onPress={() => void generateReflection()}
						style={({ pressed }) => [
							styles.generateButton,
							(pressed || isGenerating) && styles.generateButtonPressed,
						]}
					>
						{isGenerating ? (
							<ActivityIndicator
								color={themeColors.primaryContrast}
								size="small"
							/>
						) : (
							<Ionicons
								color={themeColors.primaryContrast}
								name="sparkles"
								size={18}
							/>
						)}
						<Text style={styles.generateButtonText}>
							{isGenerating ? "Generating..." : "Generate Reflection"}
						</Text>
					</Pressable>
				</>
			)}

			{errorMessage ? (
				<Text style={styles.errorText}>{errorMessage}</Text>
			) : null}
		</View>
	);
}

function ReflectionSection({
	iconName,
	label,
	text,
}: {
	iconName: ComponentProps<typeof Ionicons>["name"];
	label: string;
	text: string;
}) {
	const { themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return (
		<View style={styles.sectionBox}>
			<View style={styles.sectionHeader}>
				<Ionicons color={themeColors.primary} name={iconName} size={16} />
				<Text style={styles.sectionLabel}>{label}</Text>
			</View>
			<Text style={styles.sectionText}>{text}</Text>
		</View>
	);
}

function DisclaimerText({ text }: { text: string }) {
	const { themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return (
		<View style={styles.disclaimerRow}>
			<Ionicons color={themeColors.primary} name="checkmark-circle" size={17} />
			<Text style={styles.disclaimerText}>{text}</Text>
		</View>
	);
}

function SnapshotNotice({
	expanded,
	onToggle,
	snapshot,
}: {
	expanded: boolean;
	onToggle: () => void;
	snapshot: DiaryReflectionInputSnapshot | null;
}) {
	const { themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);
	const diaryEntry = snapshot?.diaryEntry;

	return (
		<View style={styles.snapshotBox}>
			<Pressable
				accessibilityRole="button"
				onPress={onToggle}
				style={styles.snapshotHeader}
			>
				<View style={styles.snapshotTitleRow}>
					<Ionicons
						color={themeColors.primary}
						name="create-outline"
						size={15}
					/>
					<Text style={styles.snapshotTitle}>
						Content modified after AI reflection
					</Text>
				</View>
				<Ionicons
					color={themeColors.textSecondary}
					name={expanded ? "chevron-up" : "chevron-down"}
					size={18}
				/>
			</Pressable>
			{expanded && diaryEntry ? (
				<View style={styles.snapshotContent}>
					{diaryEntry.title ? (
						<Text style={styles.snapshotLabel}>Original title</Text>
					) : null}
					{diaryEntry.title ? (
						<Text style={styles.snapshotText}>{diaryEntry.title}</Text>
					) : null}
					<Text style={styles.snapshotLabel}>Original content</Text>
					<Text style={styles.snapshotText}>{diaryEntry.content}</Text>
					<Text style={styles.snapshotMeta}>{diaryEntry.diaryDate}</Text>
				</View>
			) : null}
		</View>
	);
}

function formatGeneratedDate(
	value: string,
	timeZone?: string,
	locale = "en-US",
) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone,
	}).format(date);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		bodyText: {
			...typography.body,
			color: themeColors.textPrimary,
			lineHeight: 22,
		},
		card: {
			backgroundColor: themeColors.secondary,
			borderColor: themeColors.border,
			borderWidth: 1,
			gap: spacing.sm,
			marginTop: spacing.md,
		},
		disclaimerBox: {
			alignSelf: "stretch",
			gap: spacing.sm,
			paddingRight: spacing.sm,
		},
		disclaimerRow: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.sm,
		},
		disclaimerText: {
			...typography.caption,
			color: themeColors.textSecondary,
			flex: 1,
			lineHeight: 18,
		},
		errorText: {
			...typography.caption,
			color: themeColors.error,
			lineHeight: 18,
		},
		footerMeta: {
			alignItems: "flex-end",
			flex: 1,
			gap: 2,
		},
		footerRow: {
			alignItems: "flex-end",
			flexDirection: "row",
			gap: spacing.sm,
			justifyContent: "flex-end",
			marginTop: spacing.xs,
		},
		generateButton: {
			alignItems: "center",
			alignSelf: "flex-start",
			backgroundColor: themeColors.primary,
			borderRadius: 12,
			flexDirection: "row",
			gap: spacing.xs,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
		},
		generateButtonPressed: {
			opacity: 0.78,
		},
		generateButtonText: {
			...typography.label,
			color: themeColors.primaryContrast,
			fontWeight: "800",
		},
		generatedText: {
			...typography.caption,
			color: themeColors.textSecondary,
			textAlign: "right",
		},
		headerRow: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "space-between",
		},
		headerTitleRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
		},
		headline: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
			fontSize: 20,
			lineHeight: 26,
		},
		label: {
			...typography.label,
			color: themeColors.primary,
			fontWeight: "800",
		},
		loadingRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
		},
		outdatedRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: 4,
			justifyContent: "flex-end",
		},
		outdatedText: {
			...typography.caption,
			color: themeColors.primary,
			fontSize: 11,
			fontWeight: "700",
		},
		rerunButton: {
			alignItems: "center",
			height: 28,
			justifyContent: "center",
			width: 28,
		},
		sectionBox: {
			backgroundColor: themeColors.tintSurface,
			borderRadius: 12,
			gap: spacing.xs,
			padding: spacing.sm,
		},
		sectionHeader: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.xs,
		},
		sectionLabel: {
			...typography.caption,
			color: themeColors.primary,
			fontWeight: "800",
		},
		sectionText: {
			...typography.caption,
			color: themeColors.textPrimary,
			lineHeight: 19,
		},
		snapshotBox: {
			backgroundColor: themeColors.tintSurface,
			borderColor: themeColors.tintBorder,
			borderRadius: 12,
			borderWidth: 1,
			marginTop: spacing.xs,
			overflow: "hidden",
		},
		snapshotContent: {
			gap: spacing.xs,
			padding: spacing.sm,
			paddingTop: 0,
		},
		snapshotHeader: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "space-between",
			padding: spacing.sm,
		},
		snapshotLabel: {
			...typography.caption,
			color: themeColors.primary,
			fontWeight: "800",
		},
		snapshotMeta: {
			...typography.caption,
			color: themeColors.textSecondary,
			lineHeight: 18,
		},
		snapshotText: {
			...typography.caption,
			color: themeColors.textPrimary,
			lineHeight: 19,
		},
		snapshotTitle: {
			...typography.caption,
			color: themeColors.primary,
			fontWeight: "800",
		},
		snapshotTitleRow: {
			alignItems: "center",
			flex: 1,
			flexDirection: "row",
			gap: spacing.xs,
		},
	});
}
