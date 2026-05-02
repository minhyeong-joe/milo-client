import { RoutineIcon } from "@/components/routine/RoutineIcon";
import { useRoutineData } from "@/context/RoutineDataContext";
import type { SleepEvent, SleepType } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { formatClockTime, formatDuration, getSleepDurationMinutes } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
	DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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

const NOTES_LIMIT = 100;
const sleepTypes: SleepType[] = ["nap", "nighttime"];

type PickerTarget = "start" | "end";
type PickerMode = "date" | "time";
type ActivePicker = { mode: PickerMode; target: PickerTarget } | null;

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(value);
}

function DateTimeRow({
	icon,
	hint,
	onPress,
	value,
}: {
	icon: "calendar-outline" | "time-outline";
	hint: string;
	onPress: () => void;
	value: string;
}) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.dateTimeField}>
			<Ionicons color={colors.light.textSecondary} name={icon} size={20} />
			<View>
				<Text style={styles.dateTimeValue}>{value}</Text>
				<Text style={styles.dateTimeHint}>{hint}</Text>
			</View>
		</Pressable>
	);
}

export default function AddSleepScreen() {
	const router = useRouter();
	const { sleepId } = useLocalSearchParams<{ sleepId?: string }>();
	const { addSleep, dailyLogs, getLatestSleep, updateSleep } = useRoutineData();
	const sleepToEdit = dailyLogs
		.flatMap((day) => day.timeline)
		.find(
			(event): event is SleepEvent =>
				event.kind === "sleep" && event.id === sleepId,
		);
	const latestSleep = getLatestSleep();
	const isEndMode = Boolean(sleepToEdit);
	const [activePicker, setActivePicker] = useState<ActivePicker>(null);
	const [sleepType, setSleepType] = useState<SleepType>(
		sleepToEdit?.type ?? latestSleep?.type ?? "nap",
	);
	const [startTime, setStartTime] = useState(
		() => new Date(sleepToEdit?.startTime ?? Date.now()),
	);
	const [endTime, setEndTime] = useState<Date | undefined>(() => {
		if (!sleepToEdit) {
			return undefined;
		}

		return sleepToEdit.endTime ? new Date(sleepToEdit.endTime) : new Date();
	});
	const [notes, setNotes] = useState(sleepToEdit?.notes ?? "");

	const errorMessage =
		endTime && endTime.getTime() < startTime.getTime()
			? "End time must be after start time."
			: "";
	const durationMinutes = endTime
		? getSleepDurationMinutes(startTime.toISOString(), endTime.toISOString())
		: undefined;

	const handlePickerChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") {
			setActivePicker(null);
		}

		if (event.type === "dismissed" || !selectedDate || !activePicker) {
			return;
		}

		if (activePicker.target === "start") {
			setStartTime(selectedDate);
		} else {
			setEndTime(selectedDate);
		}
	};

	const saveSleep = () => {
		if (errorMessage) {
			return;
		}

		const input = {
			endTime: endTime?.toISOString(),
			notes,
			startTime: startTime.toISOString(),
			type: sleepType,
		};

		if (sleepToEdit) {
			updateSleep({ ...input, id: sleepToEdit.id });
		} else {
			addSleep(input);
		}

		router.back();
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={styles.keyboardView}
			>
				<View style={styles.header}>
					<Pressable
						accessibilityRole="button"
						onPress={() => router.back()}
						style={styles.headerButton}
					>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
					<View style={styles.headerTitle}>
						<RoutineIcon style={routineConfig.quickActions.sleep} size={30} />
						<Text style={globalStyles.sectionTitleText}>Sleep</Text>
					</View>
					<View style={styles.headerSpacer} />
				</View>

				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Type</Text>
						<View style={styles.segmentGrid}>
							{sleepTypes.map((type) => {
								const isSelected = sleepType === type;

								return (
									<Pressable
										accessibilityRole="button"
										key={type}
										onPress={() => setSleepType(type)}
										style={[
											styles.segmentButton,
											isSelected && styles.segmentButtonSelected,
										]}
									>
										<Text
											style={[
												styles.segmentText,
												isSelected && styles.segmentTextSelected,
											]}
										>
											{routineConfig.sleepTypes[type]}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>

					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Start</Text>
						<DateTimeRow
							hint="Start date"
							icon="calendar-outline"
							onPress={() => setActivePicker({ mode: "date", target: "start" })}
							value={formatDate(startTime)}
						/>
						<DateTimeRow
							hint="Start time"
							icon="time-outline"
							onPress={() => setActivePicker({ mode: "time", target: "start" })}
							value={formatClockTime(startTime.toISOString())}
						/>
					</View>

					<View style={styles.section}>
						<View style={globalStyles.rowBetween}>
							<Text style={styles.sectionLabel}>End</Text>
							{endTime && !isEndMode ? (
								<Pressable accessibilityRole="button" onPress={() => setEndTime(undefined)}>
									<Text style={styles.inlineAction}>Remove</Text>
								</Pressable>
							) : null}
						</View>
						{endTime ? (
							<>
								<DateTimeRow
									hint="End date"
									icon="calendar-outline"
									onPress={() => setActivePicker({ mode: "date", target: "end" })}
									value={formatDate(endTime)}
								/>
								<DateTimeRow
									hint="End time"
									icon="time-outline"
									onPress={() => setActivePicker({ mode: "time", target: "end" })}
									value={formatClockTime(endTime.toISOString())}
								/>
								{durationMinutes !== undefined && !errorMessage ? (
									<Text style={styles.durationText}>
										Duration: {formatDuration(durationMinutes)}
									</Text>
								) : null}
							</>
						) : (
							<Pressable
								accessibilityRole="button"
								onPress={() => setEndTime(new Date())}
								style={styles.addEndButton}
							>
								<Ionicons color={colors.light.primary} name="add" size={20} />
								<Text style={styles.addEndText}>Add end time</Text>
							</Pressable>
						)}
						{errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
						{activePicker ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								mode={activePicker.mode}
								onChange={handlePickerChange}
								value={activePicker.target === "start" ? startTime : (endTime ?? new Date())}
							/>
						) : null}
					</View>

					<View style={styles.section}>
						<View style={globalStyles.rowBetween}>
							<Text style={styles.sectionLabel}>Notes</Text>
							<Text style={styles.notesCount}>
								{notes.length}/{NOTES_LIMIT}
							</Text>
						</View>
						<TextInput
							maxLength={NOTES_LIMIT}
							multiline
							onChangeText={setNotes}
							placeholder="Optional notes..."
							placeholderTextColor={colors.light.textSecondary}
							style={styles.notesInput}
							textAlignVertical="top"
							value={notes}
						/>
					</View>
				</ScrollView>

				<View style={styles.footer}>
					<Pressable
						accessibilityRole="button"
						disabled={Boolean(errorMessage)}
						onPress={saveSleep}
						style={[styles.saveButton, errorMessage && styles.saveButtonDisabled]}
					>
						<Text style={styles.saveButtonText}>
							{isEndMode ? "Save Sleep" : "Start Sleep"}
						</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	addEndButton: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "center",
		padding: spacing.md,
	},
	addEndText: {
		color: colors.light.primary,
		fontSize: 15,
		fontWeight: "800",
	},
	cancelText: {
		color: colors.light.primary,
		fontSize: 15,
		fontWeight: "700",
	},
	content: {
		gap: spacing.lg,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	dateTimeField: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	dateTimeHint: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		marginTop: 2,
	},
	dateTimeValue: {
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "800",
	},
	durationText: {
		color: colors.light.textSecondary,
		fontSize: 13,
		fontWeight: "700",
	},
	errorText: {
		color: "#D92D20",
		fontSize: 13,
		fontWeight: "700",
	},
	footer: {
		backgroundColor: colors.light.background,
		padding: spacing.md,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	headerButton: {
		minWidth: 72,
		paddingVertical: spacing.sm,
	},
	headerSpacer: {
		width: 72,
	},
	headerTitle: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	inlineAction: {
		color: colors.light.primary,
		fontSize: 13,
		fontWeight: "800",
	},
	keyboardView: {
		flex: 1,
	},
	notesCount: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "700",
	},
	notesInput: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		color: colors.light.textPrimary,
		fontSize: 15,
		minHeight: 96,
		padding: spacing.md,
	},
	saveButton: {
		alignItems: "center",
		backgroundColor: routineConfig.quickActions.sleep.accentColor,
		borderRadius: 16,
		paddingVertical: 16,
	},
	saveButtonDisabled: {
		opacity: 0.5,
	},
	saveButtonText: {
		color: colors.light.surface,
		fontSize: 16,
		fontWeight: "800",
	},
	section: {
		gap: spacing.sm,
	},
	sectionLabel: {
		color: colors.light.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
	segmentButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		paddingHorizontal: spacing.sm,
		paddingVertical: 14,
	},
	segmentButtonSelected: {
		backgroundColor: routineConfig.quickActions.sleep.backgroundColor,
		borderColor: routineConfig.quickActions.sleep.accentColor,
	},
	segmentGrid: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	segmentText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "700",
		textAlign: "center",
	},
	segmentTextSelected: {
		color: routineConfig.quickActions.sleep.accentColor,
	},
});
