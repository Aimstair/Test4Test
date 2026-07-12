import { Platform } from 'react-native';
import SpInAppUpdates, {
  IAUUpdateKind,
  StartUpdateOptions,
} from 'sp-react-native-in-app-updates';

export const checkForInAppUpdates = async () => {
  try {
    // In-app updates are currently only fully functional on Android via Play Core
    // On iOS, this library prompts the user to open the App Store.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    const inAppUpdates = new SpInAppUpdates(
      false // isDebug
    );

    const result = await inAppUpdates.checkNeedsUpdate();

    if (result.shouldUpdate) {
      let updateOptions: StartUpdateOptions = {};
      
      if (Platform.OS === 'android') {
        // FLEXIBLE: Downloads in background, prompts to restart when done
        // IMMEDIATE: Full screen block forcing the user to update
        updateOptions = {
          updateType: IAUUpdateKind.FLEXIBLE,
        };
      }
      
      await inAppUpdates.startUpdate(updateOptions);
    }
  } catch (error) {
    console.warn('Failed to check for in-app updates:', error);
  }
};
