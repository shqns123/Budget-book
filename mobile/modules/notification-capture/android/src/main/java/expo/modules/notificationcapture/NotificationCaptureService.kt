package expo.modules.notificationcapture

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Bound by Android once the user turns on 알림 접근 for the app. It keeps running while the app is
 * closed, so payments made with the app shut still reach the 대기함 (see NoticeStore).
 */
class NotificationCaptureService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      NoticeStore.capture(applicationContext, sbn)
    } catch (e: Exception) {
      // A notice that can't be read is skipped; the listener must keep running.
    }
  }

  override fun onListenerConnected() {
    // Notices still on the shade when the listener (re)connects: the store skips ones it has.
    try {
      activeNotifications?.forEach { NoticeStore.capture(applicationContext, it) }
    } catch (e: Exception) {
      // ignore
    }
  }
}
