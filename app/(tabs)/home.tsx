import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { globalStyles } from "@/styles/globalStyles";

export default function HomeScreen() {
	return (
		<SafeAreaView style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<Text style={globalStyles.titleText}>Home Screen</Text>
				<Text style={globalStyles.bodyText}>
					Main screen for logging sleep, meal, and diaper.
				</Text>
			</View>
		</SafeAreaView>
	);
}
