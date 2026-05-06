/**
 * Global navigation ref — shared between App.tsx (NavigationContainer) and
 * any component/service that needs to navigate outside of React tree context.
 *
 * Usage in components: prefer `navigation.getParent()` when already inside a
 * nested navigator. Use this ref only when no navigation prop is available
 * (e.g. GameInviteBanner renders outside the Tab.Navigator tree).
 */

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

/**
 * Navigate to GameLobby from anywhere — works from root, tab, or nested screen.
 * Switches to the Play tab then pushes GameLobby with the given params.
 */
export function navigateToGameLobby(
  roomId: string,
  gameId: 'ludo' | 'truth-dare',
): void {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Play',
      params: {
        screen: 'GameLobby',
        params: { roomId, gameId },
      },
    }),
  );
}
