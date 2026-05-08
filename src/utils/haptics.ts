import * as Haptics from 'expo-haptics';

export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}
