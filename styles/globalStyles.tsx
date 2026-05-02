import { StyleSheet } from "react-native";

export const colors = {
	light: {
		background: "#F8F8FB",
		border: "#ECEEF3",
		primary: "#7C5CE7",
		surface: "#FFFFFF",
		textPrimary: "#151827",
		textSecondary: "#6B7280",
	},
	dark: {
		background: "#11131A",
		border: "#2A2D38",
		primary: "#9B7CFF",
		surface: "#1A1D26",
		textPrimary: "#F7F7FA",
		textSecondary: "#A8ADBA",
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

export const globalStyles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.light.background,
	},
	screenContent: {
		flex: 1,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	card: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 18,
		borderWidth: 1,
		padding: spacing.md,
	},
	labelText: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	mutedText: {
		color: colors.light.textSecondary,
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
		color: colors.light.textPrimary,
	},
	shadowCard: {
		shadowColor: "#1F2937",
		shadowOffset: { height: 8, width: 0 },
		shadowOpacity: 0.08,
		shadowRadius: 18,
		elevation: 3,
	},
	titleText: {
		...typography.title,
		color: colors.light.textPrimary,
	},
	bodyText: {
		...typography.body,
		color: colors.light.textSecondary,
	},
});
