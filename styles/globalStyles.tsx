import { StyleSheet } from "react-native";

const baseColors = {
	light: {
		background: "#F8F8FB",
		border: "#ECEEF3",
		primary: "#7C5CE7",
		secondary: "#F8F3FF",
		surface: "#FFFFFF",
		sleep: "#F7FAFF",
		success: "#92eeb4",
		textPrimary: "#151827",
		textSecondary: "#6B7280",
		error: "#EF4444",
	},
	dark: {
		background: "#11131A",
		border: "#2A2D38",
		primary: "#9B7CFF",
		secondary: "#11131A",
		surface: "#1A1D26",
		sleep: "#13192c",
		success: "#71f1a0",
		textPrimary: "#F7F7FA",
		textSecondary: "#A8ADBA",
		error: "#EF4444",
	},
} as const;

export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 20,
	xl: 24,
} as const;

export const typography = {
	title: {
		fontSize: 28,
		fontWeight: "800",
	},
	screenTitle: {
		fontSize: 24,
		fontWeight: "800",
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "800",
	},
	itemTitle: {
		fontSize: 16,
		fontWeight: "800",
	},
	label: {
		fontSize: 15,
		fontWeight: "800",
	},
	caption: {
		fontSize: 12,
		fontWeight: "600",
	},
	body: {
		fontSize: 15,
		lineHeight: 22,
	},
	tabLabel: {
		fontSize: 11,
		fontWeight: "600",
	},
} as const;

export const themePalettes = baseColors;

export const colors = baseColors;

export type ResolvedTheme = keyof typeof colors;
export type ThemeColors = (typeof colors)[ResolvedTheme];

export function createGlobalStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: themeColors.background,
		},
		screenContent: {
			flex: 1,
			paddingHorizontal: spacing.md,
			paddingTop: spacing.md,
		},
		scrollContent: {
			gap: spacing.md,
			paddingBottom: spacing.md,
		},
		card: {
			backgroundColor: themeColors.surface,
			borderColor: themeColors.border,
			borderRadius: 18,
			borderWidth: 1,
			padding: spacing.md,
		},
		labelText: {
			...typography.label,
			color: themeColors.textPrimary,
		},
		mutedText: {
			color: themeColors.textSecondary,
		},
		rowBetween: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "space-between",
		},
		rowCenter: {
			alignItems: "center",
			flexDirection: "row",
		},
		sectionTitleText: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		shadowCard: {
			shadowColor: themeColors.textPrimary,
			shadowOffset: { height: 8, width: 0 },
			shadowOpacity: 0.08,
			shadowRadius: 18,
			elevation: 3,
		},
		titleText: {
			...typography.title,
			color: themeColors.textPrimary,
		},
		bodyText: {
			...typography.body,
			color: themeColors.textSecondary,
		},
	});
}
