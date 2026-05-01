import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { globalStyles } from "@/styles/globalStyles";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={globalStyles.screenContent}>
        <Text style={globalStyles.titleText}>Settings Screen</Text>
        <Text style={globalStyles.bodyText}>
          Baby profile, AI preferences, app settings, and account settings.
        </Text>
      </View>
    </SafeAreaView>
  );
}
