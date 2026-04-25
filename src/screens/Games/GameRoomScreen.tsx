import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import { colors } from '../../utils/theme';

export default function GameRoomScreen() {
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
});
