import { useAppTheme } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
	const { globalStyles, themeColors } = useAppTheme();
	const { isReady, session } = useAuthSession();

	if (!isReady) {
		return (
			<View
				style={[
					globalStyles.screen,
					{ alignItems: "center", justifyContent: "center" },
				]}
			>
				<ActivityIndicator color={themeColors.primary} />
			</View>
		);
	}

	return <Redirect href={session ? "/home" : "/sign-in"} />;
}