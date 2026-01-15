// DISABLED: Notifications not working with Expo Go
// import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';
// date-fns-tz is now used instead of dayjs (when notifications are re-enabled)

// DISABLED: Notifications not working with Expo Go
// Configure notification handler (with error handling for Expo Go)
// try {
//   Notifications.setNotificationHandler({
//     handleNotification: async () => ({
//       shouldShowAlert: true,
//       shouldPlaySound: true,
//       shouldSetBadge: true,
//     }),
//   });
// } catch (error) {
//   // In Expo Go, some notification features may not be available
//   // Local scheduled notifications should still work
//   console.warn('Notification handler setup warning (may be expected in Expo Go):', error);
// }

/**
 * Check if notifications are available (not available in Expo Go for remote, but local should work)
 * DISABLED: Notifications not working with Expo Go
 */
function isNotificationsAvailable(): boolean {
  // DISABLED: Notifications not working with Expo Go
  return false;
  // try {
  //   // Check if the module is available
  //   return Notifications !== null && typeof Notifications.getPermissionsAsync === 'function';
  // } catch {
  //   return false;
  // }
}

/**
 * Request notification permissions
 * DISABLED: Notifications not working with Expo Go
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  // DISABLED: Notifications not working with Expo Go
  return false;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     console.warn('Notifications not available in this environment');
  //     return false;
  //   }

  //   const { status: existingStatus } = await Notifications.getPermissionsAsync();
  //   let finalStatus = existingStatus;

  //   if (existingStatus !== 'granted') {
  //     const { status } = await Notifications.requestPermissionsAsync();
  //     finalStatus = status;
  //   }

  //   if (finalStatus !== 'granted') {
  //     console.warn('Notification permissions not granted');
  //     return false;
  //   }

  //   // Configure notification channel for Android (may not work in Expo Go)
  //   if (Platform.OS === 'android') {
  //     try {
  //       await Notifications.setNotificationChannelAsync('default', {
  //         name: 'Default',
  //         importance: Notifications.AndroidImportance.HIGH,
  //         vibrationPattern: [0, 250, 250, 250],
  //         lightColor: '#FF231F7C',
  //       });
  //     } catch (error) {
  //       // Channel setup may fail in Expo Go, but local notifications should still work
  //       console.warn('Could not set notification channel (may be expected in Expo Go):', error);
  //     }
  //   }

  //   return true;
  // } catch (error) {
  //   console.error('Error requesting notification permissions:', error);
  //   return false;
  // }
}

/**
 * Schedule a Friday afternoon reminder for weekly hours confirmation
 * Schedules for every Friday at 3:00 PM
 * Note: Local scheduled notifications work in Expo Go, but remote push notifications do not
 * DISABLED: Notifications not working with Expo Go
 */
export async function scheduleFridayReminder(): Promise<string | null> {
  // DISABLED: Notifications not working with Expo Go
  return null;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     console.warn('Notifications not available, cannot schedule Friday reminder');
  //     return null;
  //   }

  //   const hasPermission = await requestNotificationPermissions();
  //   if (!hasPermission) {
  //     return null;
  //   }

  //   // Cancel any existing Friday reminders
  //   await cancelFridayReminder();

  //   // Calculate next Friday at 3:00 PM
  //   const now = dayjs();
  //   let nextFriday = now.day(5); // Friday is day 5
  //   if (nextFriday.isBefore(now) || nextFriday.isSame(now, 'hour')) {
  //     nextFriday = nextFriday.add(7, 'days');
  //   }
  //   nextFriday = nextFriday.hour(15).minute(0).second(0).millisecond(0);

  //   const notificationId = await Notifications.scheduleNotificationAsync({
  //     content: {
  //       title: 'Weekly Hours Confirmation Reminder',
  //       body: "Don't forget to confirm your weekly hours!",
  //       sound: true,
  //       priority: Notifications.AndroidNotificationPriority.HIGH,
  //       data: {
  //         type: 'weekly_confirmation_reminder',
  //       },
  //     },
  //     trigger: {
  //       weekday: 5, // Friday
  //       hour: 15, // 3 PM
  //       minute: 0,
  //       repeats: true,
  //     },
  //   });

  //   return notificationId;
  // } catch (error) {
  //   // In Expo Go, local notifications should work, but catch any errors gracefully
  //   console.warn('Error scheduling Friday reminder (may be expected in Expo Go):', error);
  //   return null;
  // }
}

/**
 * Schedule a daily reminder to confirm hours worked
 * Schedules for every day at 5:00 PM
 * Note: Local scheduled notifications work in Expo Go, but remote push notifications do not
 * DISABLED: Notifications not working with Expo Go
 */
export async function scheduleDailyReminder(): Promise<string | null> {
  // DISABLED: Notifications not working with Expo Go
  return null;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     console.warn('Notifications not available, cannot schedule daily reminder');
  //     return null;
  //   }

  //   const hasPermission = await requestNotificationPermissions();
  //   if (!hasPermission) {
  //     return null;
  //   }

  //   // Cancel any existing daily reminders
  //   await cancelDailyReminder();

  //   const notificationId = await Notifications.scheduleNotificationAsync({
  //     content: {
  //       title: 'Confirm Hours Worked Today',
  //       body: 'Please confirm your hours worked for today.',
  //       sound: true,
  //       priority: Notifications.AndroidNotificationPriority.HIGH,
  //       data: {
  //         type: 'daily_confirmation_reminder',
  //       },
  //     },
  //     trigger: {
  //       hour: 17, // 5 PM
  //       minute: 0,
  //       repeats: true,
  //     },
  //   });

  //   return notificationId;
  // } catch (error) {
  //   // In Expo Go, local notifications should work, but catch any errors gracefully
  //   console.warn('Error scheduling daily reminder (may be expected in Expo Go):', error);
  //   return null;
  // }
}

/**
 * Cancel Friday reminder notifications
 * DISABLED: Notifications not working with Expo Go
 */
export async function cancelFridayReminder(): Promise<void> {
  // DISABLED: Notifications not working with Expo Go
  return;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     return;
  //   }
  //   const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  //   for (const notification of allNotifications) {
  //     if (notification.content.data?.type === 'weekly_confirmation_reminder') {
  //       await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  //     }
  //   }
  // } catch (error) {
  //   console.warn('Error canceling Friday reminder:', error);
  // }
}

/**
 * Cancel daily reminder notifications
 * DISABLED: Notifications not working with Expo Go
 */
export async function cancelDailyReminder(): Promise<void> {
  // DISABLED: Notifications not working with Expo Go
  return;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     return;
  //   }
  //   const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  //   for (const notification of allNotifications) {
  //     if (notification.content.data?.type === 'daily_confirmation_reminder') {
  //       await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  //     }
  //   }
  // } catch (error) {
  //   console.warn('Error canceling daily reminder:', error);
  // }
}

/**
 * Cancel all scheduled notifications
 * DISABLED: Notifications not working with Expo Go
 */
export async function cancelAllNotifications(): Promise<void> {
  // DISABLED: Notifications not working with Expo Go
  return;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     return;
  //   }
  //   await Notifications.cancelAllScheduledNotificationsAsync();
  // } catch (error) {
  //   console.warn('Error canceling all notifications:', error);
  // }
}

/**
 * Get all scheduled notifications
 * DISABLED: Notifications not working with Expo Go
 */
export async function getAllScheduledNotifications(): Promise<any[]> {
  // DISABLED: Notifications not working with Expo Go
  return [];
  // try {
  //   if (!isNotificationsAvailable()) {
  //     return [];
  //   }
  //   return await Notifications.getAllScheduledNotificationsAsync();
  // } catch (error) {
  //   console.warn('Error getting scheduled notifications:', error);
  //   return [];
  // }
}

/**
 * Initialize all notification schedules
 * Call this when the app starts or when user enables notifications
 * Note: Local scheduled notifications work in Expo Go, but remote push notifications do not
 * DISABLED: Notifications not working with Expo Go
 */
export async function initializeNotifications(): Promise<void> {
  // DISABLED: Notifications not working with Expo Go
  return;
  // try {
  //   if (!isNotificationsAvailable()) {
  //     console.warn('Notifications not available in this environment (Expo Go limitation for remote notifications)');
  //     console.warn('Local scheduled notifications should still work in development builds');
  //     return;
  //   }

  //   const hasPermission = await requestNotificationPermissions();
  //   if (!hasPermission) {
  //     console.warn('Notifications not initialized: permissions not granted');
  //     return;
  //   }

  //   // Schedule both reminders
  //   await scheduleFridayReminder();
  //   await scheduleDailyReminder();

  //   console.log('Notifications initialized successfully');
  // } catch (error) {
  //   // Gracefully handle errors - local notifications should still work
  //   console.warn('Error initializing notifications (may be expected in Expo Go):', error);
  // }
}
