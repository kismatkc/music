// components/WifiWarningBanner.tsx

import { useNetworkState } from "expo-network";
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function NetworkCheckOvelay({
  children,
}: {
  children: React.ReactNode;
}) {
  // Until the first value arrives, render nothing (prevents flash)
  const { isInternetReachable } = useNetworkState();

  // If connected (WiFi, Cellular, Ethernet, etc.), don't show banner

  // Show banner when there's NO network connection at all
  return (
    <View className="flex-1">
      {!isInternetReachable && (
        <View style={styles.banner}>
          <Text style={styles.text}>No internet connection</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#D32F2F",
    zIndex: 9999,
  },
  text: { color: "white", fontWeight: "600", textAlign: "center" },
});
