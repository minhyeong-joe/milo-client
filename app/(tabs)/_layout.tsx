import { useAppTheme } from "@/context/AppPreferencesContext";
import { typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabBarIconName = ComponentProps<typeof Ionicons>["name"];

function TabBarIcon({
	color,
	focused,
	name,
	size,
}: {
	color: string;
	focused: boolean;
	name: TabBarIconName;
	size: number;
}) {
	return (
		<Ionicons
			color={color}
			name={focused ? name : (`${name}-outline` as TabBarIconName)}
			size={size}
		/>
	);
}

export default function TabsLayout() {
	const insets = useSafeAreaInsets();
	const { themeColors } = useAppTheme();

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: themeColors.primary,
				tabBarInactiveTintColor: themeColors.textSecondary,
				tabBarLabelStyle: typography.tabLabel,
				tabBarStyle: {
					backgroundColor: themeColors.surface,
					borderTopColor: themeColors.border,
					height: 62 + insets.bottom,
					paddingBottom: Math.max(insets.bottom, 12),
					paddingTop: 8,
				},
			}}
		>
			<Tabs.Screen
				name="home"
				options={{
					title: "Home",
					tabBarIcon: ({ color, focused, size }) => (
						<TabBarIcon
							color={color}
							focused={focused}
							name="home"
							size={size}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="reports"
				options={{
					title: "Reports",
					tabBarIcon: ({ color, focused, size }) => (
						<TabBarIcon
							color={color}
							focused={focused}
							name="bar-chart"
							size={size}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="diary"
				options={{
					title: "Diary",
					tabBarIcon: ({ color, focused, size }) => (
						<TabBarIcon
							color={color}
							focused={focused}
							name="journal"
							size={size}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, focused, size }) => (
						<TabBarIcon
							color={color}
							focused={focused}
							name="settings"
							size={size}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
