import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { BabySex } from "@/services/api/babies";
import { colors, spacing, typography } from "@/styles/globalStyles";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function BabyNameField({
	label = "Baby name",
	onChangeText,
	placeholder = "Emma",
	value,
}: {
	label?: string;
	onChangeText: (value: string) => void;
	placeholder?: string;
	value: string;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				autoCapitalize="words"
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.light.textSecondary}
				style={styles.input}
				value={value}
			/>
		</View>
	);
}

export function BabyBirthdateField({
	isPickerVisible,
	label = "Birth date",
	maximumDate = new Date(),
	onChange,
	onOpenPicker,
	value,
}: {
	isPickerVisible: boolean;
	label?: string;
	maximumDate?: Date;
	onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
	onOpenPicker: () => void;
	value: Date;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<Pressable
				accessibilityRole="button"
				onPress={onOpenPicker}
				style={({ pressed }) => [styles.dateButton, pressed && styles.pressedButton]}
			>
				<Text style={styles.dateButtonText}>{formatBirthdate(value)}</Text>
				<Ionicons
					color={colors.light.textSecondary}
					name="calendar-outline"
					size={20}
				/>
			</Pressable>
			{isPickerVisible ? (
				<DateTimePicker
					display={Platform.OS === "ios" ? "spinner" : "default"}
					maximumDate={maximumDate}
					mode="date"
					onChange={onChange}
					value={value}
				/>
			) : null}
		</View>
	);
}

export function BabySexSelector({
	label = "Gender",
	onChange,
	value,
}: {
	label?: string;
	onChange: (value: BabySex) => void;
	value: BabySex;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<View style={styles.sexRow}>
				<SexButton
					active={value === "GIRL"}
					icon="female-outline"
					label="Girl"
					onPress={() => onChange("GIRL")}
				/>
				<SexButton
					active={value === "BOY"}
					icon="male-outline"
					label="Boy"
					onPress={() => onChange("BOY")}
				/>
			</View>
		</View>
	);
}

export function SexButton({
	active,
	icon,
	label,
	onPress,
}: {
	active: boolean;
	icon: IoniconName;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.sexButton,
				active && styles.sexButtonActive,
				pressed && styles.pressedButton,
			]}
		>
			<Ionicons
				color={active ? colors.light.primary : colors.light.textSecondary}
				name={icon}
				size={18}
			/>
			<Text style={[styles.sexText, active && styles.sexTextActive]}>{label}</Text>
		</Pressable>
	);
}

export function formatBabyProfileDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

export function formatBirthdate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date);
}

const styles = StyleSheet.create({
	dateButton: {
		alignItems: "center",
		backgroundColor: colors.light.background,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		minHeight: 50,
		paddingHorizontal: spacing.md,
	},
	dateButtonText: {
		...typography.body,
		color: colors.light.textPrimary,
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
	pressedButton: {
		opacity: 0.75,
	},
	sexButton: {
		alignItems: "center",
		borderRadius: 11,
		flex: 1,
		flexDirection: "row",
		gap: spacing.xs,
		justifyContent: "center",
		minHeight: 42,
	},
	sexButtonActive: {
		backgroundColor: colors.light.surface,
	},
	sexRow: {
		backgroundColor: colors.light.background,
		borderRadius: 14,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.xs,
	},
	sexText: {
		...typography.label,
		color: colors.light.textSecondary,
	},
	sexTextActive: {
		color: colors.light.primary,
	},
});
