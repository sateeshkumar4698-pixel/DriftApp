import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import { useTheme, AppColors } from '../../utils/useTheme';

export default function GameRoomScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);

  return (
    <SafeAreaView style={styles.flex}>
      <EmptyState
        emoji="🎮"
        title="Game Room"
        subtitle="Multiplayer game logic coming in Phase 2. Invite a match to play!"
      />
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
  });
}
