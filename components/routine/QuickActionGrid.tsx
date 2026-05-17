import { useMemo, useState } from "react";
import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { RoutineIcon } from "./RoutineIcon";

type QuickActionStyle = {
	accentColor: string;
	backgroundColor: string;
};

type RoutineQuickActionItem = {
	id: RoutineKind;
	kind: "routine";
	lastActionLabel: string;
};

type NavigationQuickActionItem = QuickActionStyle & {
	detailLabel: string;
	id: string;
	icon: React.ComponentProps<typeof Ionicons>["name"];
	kind: "navigation";
	label: string;
	onPress: () => void;
};

export type QuickActionItem = RoutineQuickActionItem | NavigationQuickActionItem;

function QuickActionButton({
	action,
	config,
	onPress,
	width,
}: {
	action: QuickActionItem;
	config: RoutineConfig;
	onPress?: (kind: RoutineKind) => void;
	width: number;
}) {
	const { globalStyles, styles } = useThemeStyles();
	const isRoutineAction = action.kind === "routine";
	const iconInfo = isRoutineAction ? config.quickActions[action.id] : action;
	const label = isRoutineAction ? iconInfo.label : action.label;
	const detail = isRoutineAction ? action.lastActionLabel : action.detailLabel;
	const handlePress = () => {
		if (isRoutineAction) {
			onPress?.(action.id);
			return;
		}

		action.onPress();
	};

	return (
		<Pressable
			accessibilityRole="button"
			onPress={handlePress}
			style={[styles.quickAction, { width }]}
		>
			<View style={styles.quickIcon}>
				{isRoutineAction ? (
					<RoutineIcon size={56} kind={action.id} />
				) : (
					<View
						style={[
							styles.navIcon,
							{ backgroundColor: iconInfo.backgroundColor },
						]}
					>
						<Ionicons
							color={iconInfo.accentColor}
							name={action.icon}
							size={31}
						/>
					</View>
				)}
			</View>
			<Text style={[globalStyles.labelText, styles.quickLabel]}>
				{label}
			</Text>
			<Text numberOfLines={1} style={styles.quickDetail}>{detail ?? ""}</Text>
		</Pressable>
	);
}

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function QuickActionGrid({
	actions,
	config,
	onActionPress,
}: {
	actions: QuickActionItem[];
	config: RoutineConfig;
	onActionPress?: (kind: RoutineKind) => void;
}) {
	const { themeColors, styles } = useThemeStyles();
	const { width } = useWindowDimensions();
	const [contentWidth, setContentWidth] = useState(0);
	const [scrollX, setScrollX] = useState(0);
	const [viewportWidth, setViewportWidth] = useState(0);
	const itemWidth = Math.max(
		82,
		(width - spacing.md * 2 - spacing.md * 2) / 3,
	);
	const hasMoreToLeft = contentWidth > viewportWidth && scrollX > 8;
	const hasMoreToRight =
		contentWidth > viewportWidth &&
		scrollX < contentWidth - viewportWidth - 8;

	return (
		<View style={styles.quickGridFrame}>
			<ScrollView
				contentContainerStyle={styles.quickGridContent}
				horizontal
				onContentSizeChange={(nextContentWidth) => setContentWidth(nextContentWidth)}
				onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
				onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
				scrollEventThrottle={16}
				showsHorizontalScrollIndicator={false}
				style={styles.quickGrid}
			>
				{actions.map((action) => (
					<QuickActionButton
						action={action}
						config={config}
						key={action.id}
						onPress={onActionPress}
						width={itemWidth}
					/>
				))}
			</ScrollView>
			{hasMoreToLeft ? (
				<View pointerEvents="none" style={[styles.scrollCue, styles.scrollCueLeft]}>
					<View style={[styles.scrollCueIcon, styles.scrollCueIconLeft]}>
						<Ionicons
							color={themeColors.textSecondary}
							name="chevron-back"
							size={18}
						/>
					</View>
				</View>
			) : null}
			{hasMoreToRight ? (
				<View pointerEvents="none" style={[styles.scrollCue, styles.scrollCueRight]}>
					<View style={styles.scrollCueIcon}>
						<Ionicons
							color={themeColors.textSecondary}
							name="chevron-forward"
							size={18}
						/>
					</View>
				</View>
			) : null}
		</View>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	navIcon: {
		alignItems: "center",
		borderRadius: 28,
		height: 56,
		justifyContent: "center",
		width: 56,
	},
	quickAction: {
		alignItems: "center",
		minHeight: 100,
	},
	quickDetail: {
		color: themeColors.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
		marginTop: spacing.xs,
		textAlign: "center",
	},
	quickGrid: {
		marginHorizontal: -spacing.md,
		minHeight: 104,
	},
	quickGridContent: {
		alignItems: "flex-start",
		gap: spacing.md,
		paddingHorizontal: spacing.md,
	},
	quickGridFrame: {
		marginBottom: spacing.md,
		marginTop: spacing.xs,
		position: "relative",
	},
	quickIcon: {
		alignItems: "center",
		height: 56,
		justifyContent: "center",
		marginBottom: spacing.sm,
		width: 64,
	},
	quickLabel: {
		textAlign: "center",
	},
	scrollCue: {
		alignItems: "center",
		bottom: 0,
		flexDirection: "row",
		position: "absolute",
		top: 0,
		width: 46,
	},
	scrollCueLeft: {
		justifyContent: "flex-start",
		left: -spacing.md,
	},
	scrollCueRight: {
		justifyContent: "flex-end",
		right: -spacing.md,
	},
	scrollCueIcon: {
		alignItems: "center",
		height: 28,
		justifyContent: "center",
		marginRight: spacing.xs,
		width: 28,
	},
	scrollCueIconLeft: {
		marginLeft: spacing.xs,
		marginRight: 0,
	},
});
}
