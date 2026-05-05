import { useAuthSession } from "@/context/AuthSessionContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors, globalStyles } from "@/styles/globalStyles";

export default function Index() {
	const { isReady, session } = useAuthSession();

	if (!isReady) {
		return (
			<View style={[globalStyles.screen, { alignItems: "center", justifyContent: "center" }]}>
				<ActivityIndicator color={colors.light.primary} />
			</View>
		);
	}

	return <Redirect href={session ? "/home" : "/sign-in"} />;
}
