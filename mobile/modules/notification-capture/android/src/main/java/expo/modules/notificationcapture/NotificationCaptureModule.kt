package expo.modules.notificationcapture

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationCaptureModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun component(context: Context) = ComponentName(context, NotificationCaptureService::class.java)

  override fun definition() = ModuleDefinition {
    Name("NotificationCapture")

    Events("onNotice")

    OnCreate {
      NoticeStore.onCaptured = { sendEvent("onNotice", mapOf<String, Any>()) }
    }

    OnDestroy {
      NoticeStore.onCaptured = null
    }

    /** Whether the user turned on 알림 접근 for this app. */
    Function("hasAccess") {
      val context = context
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
      val mine = component(context)
      enabled.split(":").any { ComponentName.unflattenFromString(it) == mine }
    }

    /** Opens the system page where 알림 접근 is turned on (this app's own page when there is one). */
    Function("openAccessSettings") {
      val context = context
      val detail = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
          .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component(context).flattenToString())
      } else {
        null
      }
      val list = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      val activity = appContext.currentActivity
      for (intent in listOfNotNull(detail, list)) {
        try {
          if (activity != null) activity.startActivity(intent)
          else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          return@Function true
        } catch (e: Exception) {
          // Some devices lack the per-app page: fall back to the list.
        }
      }
      false
    }

    Function("getPending") {
      NoticeStore.pending(context)
    }

    Function("removePending") { ids: List<String> ->
      NoticeStore.remove(context, ids)
    }

    Function("getAllowedPackages") {
      NoticeStore.allowedPackages(context)
    }

    Function("setAllowedPackages") { packages: List<String> ->
      NoticeStore.setAllowedPackages(context, packages)
    }

    Function("getDefaultPackages") {
      NoticeStore.DEFAULT_PACKAGES
    }

    Function("getSeenApps") {
      NoticeStore.seenApps(context)
    }
  }
}
