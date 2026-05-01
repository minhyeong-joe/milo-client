import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { globalStyles } from "@/styles/globalStyles";

export default function ReportsScreen() {
  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={globalStyles.screenContent}>
        <Text style={globalStyles.titleText}>Reports Screen</Text>
        <Text style={globalStyles.bodyText}>
          Growth charts and sleep, meal, and diaper trends.
        </Text>
      </View>
    </SafeAreaView>
  );
}
