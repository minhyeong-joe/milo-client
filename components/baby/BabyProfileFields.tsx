import { useAppPreferences, useAppTheme } from "@/context/AppPreferencesContext";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import type { ComponentProps } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { BabySex, CreateBabyAvatarUploadRequest } from "@/services/api/babies";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type AvatarContentType = "image/jpeg" | "image/png" | "image/webp";

const fallbackBabyAvatar = require("@/assets/images/baby.png");

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function BabyAvatarField({
	avatarObjectKey,
	avatarUrl,
	babyId,
	disabled = false,
	onAvatarRemoved,
	onAvatarSelected,
}: {
	avatarObjectKey?: string | null;
	avatarUrl?: string | null;
	babyId?: string;
	disabled?: boolean;
	onAvatarRemoved?: () => Promise<unknown> | unknown;
	onAvatarSelected?: (input: {
		contentType: CreateBabyAvatarUploadRequest["contentType"];
		localUri: string;
	}) => Promise<unknown> | unknown;
}) {
	const { styles } = useThemeStyles();
	const canEdit = Boolean(babyId) && !disabled;

	const changeAvatar = async () => {
		if (!babyId || disabled) {
			return;
		}

		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (!permission.granted) {
			Alert.alert(
				"Photos permission needed",
				"Allow photo library access to choose a profile picture.",
			);
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			allowsEditing: true,
			aspect: [1, 1],
			mediaTypes: ["images"],
			quality: 0.85,
		});

		if (result.canceled || !result.assets[0]) {
			return;
		}

		try {
			const asset = result.assets[0];
			const contentType = getAvatarContentType(asset);
			const localUri = await copyAvatarToLocalCache(asset.uri, contentType, babyId);
			await onAvatarSelected?.({ contentType, localUri });
		} catch (error) {
			Alert.alert("Photo failed", getAvatarErrorMessage(error));
		}
	};

	const removeAvatar = async () => {
		if (!babyId || disabled || !avatarObjectKey) {
			return;
		}

		try {
			await onAvatarRemoved?.();
		} catch (error) {
			Alert.alert("Remove failed", getAvatarErrorMessage(error));
		}
	};

	return (
		<View style={styles.field}>
			<Pressable
				accessibilityRole="button"
				disabled={!canEdit}
				onPress={changeAvatar}
			>
				<Image
					source={avatarUrl ? { uri: avatarUrl } : fallbackBabyAvatar}
					style={styles.avatarPreview}
				/>
			</Pressable>
			
			{avatarObjectKey ? (
				<View>
					<Pressable
						accessibilityRole="button"
						disabled={!canEdit}
						onPress={removeAvatar}
						style={({ pressed }) => [
							styles.avatarRemoveButton,
							pressed && canEdit && styles.pressedButton,
						]}
					>
						<Text style={styles.avatarRemoveText}>Remove picture</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}

export function BabyNameField({
	label = "Baby name",
	onChangeText,
	placeholder = "Elliot",
	value,
}: {
	label?: string;
	onChangeText: (value: string) => void;
	placeholder?: string;
	value: string;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				autoCapitalize="words"
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={themeColors.textSecondary}
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
	timeZone,
	value,
}: {
	isPickerVisible: boolean;
	label?: string;
	maximumDate?: Date;
	onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
	onOpenPicker: () => void;
	timeZone?: string;
	value: Date;
}) {
	const { themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<Pressable
				accessibilityRole="button"
				onPress={onOpenPicker}
				style={({ pressed }) => [styles.dateButton, pressed && styles.pressedButton]}
			>
				<Text style={styles.dateButtonText}>
					{formatBirthdate(value, timeZone, languagePreference)}
				</Text>
				<Ionicons
					color={themeColors.textSecondary}
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
	const { styles } = useThemeStyles();
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
	const { themeColors, styles } = useThemeStyles();
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
				color={active ? themeColors.primary : themeColors.textSecondary}
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

export function formatBirthdate(date: Date, timeZone?: string, locale = "en-US") {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(date);
}

function getAvatarContentType(asset: ImagePicker.ImagePickerAsset): AvatarContentType {
	if (
		asset.mimeType === "image/png" ||
		asset.mimeType === "image/webp" ||
		asset.mimeType === "image/jpeg"
	) {
		return asset.mimeType;
	}

	const extension = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();

	if (extension === "png") {
		return "image/png";
	}

	if (extension === "webp") {
		return "image/webp";
	}

	return "image/jpeg";
}

async function copyAvatarToLocalCache(
	uri: string,
	contentType: AvatarContentType,
	babyId: string,
) {
	const extension = contentType === "image/png"
		? "png"
		: contentType === "image/webp"
			? "webp"
			: "jpg";
	const directory = new Directory(Paths.document, "milo", "avatar-cache");
	const destination = new File(directory, `${babyId}-${Date.now()}.${extension}`);
	const source = new File(uri);

	directory.create({ idempotent: true, intermediates: true });
	source.copy(destination);

	return destination.uri;
}

function getAvatarErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not update profile picture. Please try again.";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	avatarButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 12,
		paddingVertical: 12,
	},
	avatarButtonDisabled: {
		opacity: 0.45,
	},
	avatarButtonText: {
		...typography.label,
		color: themeColors.surface,
	},
	avatarPreview: {
		backgroundColor: "#D9BFAE",
		borderColor: themeColors.border,
		borderRadius: 10,
		borderWidth: 1,
		height: 300,
		width: '100%',
	},
	avatarRemoveButton: {
		alignItems: "center",
		paddingVertical: 8,
	},
	avatarRemoveText: {
		...typography.label,
		color: themeColors.error,
	},
	dateButton: {
		alignItems: "center",
		backgroundColor: themeColors.background,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		minHeight: 50,
		paddingHorizontal: spacing.md,
	},
	dateButtonText: {
		...typography.body,
		color: themeColors.textPrimary,
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
		backgroundColor: themeColors.surface,
	},
	sexRow: {
		backgroundColor: themeColors.background,
		borderRadius: 14,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.xs,
	},
	sexText: {
		...typography.label,
		color: themeColors.textSecondary,
	},
	sexTextActive: {
		color: themeColors.primary,
	},
});
}
