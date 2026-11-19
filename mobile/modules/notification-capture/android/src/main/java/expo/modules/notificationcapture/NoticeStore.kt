package expo.modules.notificationcapture

import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * The captured payment notifications, kept on the device (SharedPreferences) until the app reads
 * them into its 대기함. Only notifications from the allowed apps that look like a payment (an
 * amount in 원 plus a word such as 승인 or 출금, and no 인증번호 / 광고) are kept; nothing else is
 * stored or leaves the phone.
 */
object NoticeStore {
  private const val PREFS = "notification_capture"
  private const val KEY_PENDING = "pending"
  private const val KEY_RECENT = "recent_ids"
  private const val KEY_ALLOWED = "allowed_packages"
  private const val KEY_SEEN = "seen_apps"
  private const val MAX_PENDING = 500
  private const val MAX_RECENT = 400
  private const val MAX_SEEN = 30

  /** The apps read until the user changes the list in the app (KB Pay, 카카오뱅크, 문자). */
  val DEFAULT_PACKAGES = listOf(
    "com.kbcard.cxh.appcard",
    "com.kakaobank.channel",
    "com.samsung.android.messaging",
    "com.google.android.apps.messaging",
  )

  private val MONEY = Regex("""\d[\d,]*\s*원""")
  private val TX_WORD = Regex("승인|결제|사용|취소|출금|입금|이체")
  private val REJECT = Regex("""인증\s*번호|OTP|비밀번호|[(\[]광고[)\]]|결제\s*예정|청구\s*금액|명세서""")

  /** Called (from the listener's thread) when a notice was kept: the app reads the queue again. */
  @Volatile
  var onCaptured: (() -> Unit)? = null

  fun looksLikePayment(text: String) =
    MONEY.containsMatchIn(text) && TX_WORD.containsMatchIn(text) && !REJECT.containsMatchIn(text)

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun readArray(prefs: SharedPreferences, key: String): JSONArray =
    try {
      JSONArray(prefs.getString(key, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  private fun hash(value: String): String {
    val bytes = MessageDigest.getInstance("SHA-1").digest(value.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }.take(20)
  }

  fun allowedPackages(context: Context): List<String> {
    val prefs = prefs(context)
    if (!prefs.contains(KEY_ALLOWED)) return DEFAULT_PACKAGES
    val array = readArray(prefs, KEY_ALLOWED)
    return (0 until array.length()).map { array.getString(it) }
  }

  @Synchronized
  fun setAllowedPackages(context: Context, packages: List<String>) {
    prefs(context).edit().putString(KEY_ALLOWED, JSONArray(packages.distinct()).toString()).apply()
  }

  private fun appName(context: Context, packageName: String): String =
    try {
      val pm = context.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    } catch (e: Exception) {
      packageName
    }

  /** Reads one posted notification; keeps it when it is a payment from an allowed app. */
  @Synchronized
  fun capture(context: Context, sbn: StatusBarNotification) {
    if (sbn.packageName == context.packageName) return
    val notification = sbn.notification ?: return
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim().orEmpty()
    val whole = "$title\n$text"
    if (!looksLikePayment(whole)) return

    val prefs = prefs(context)
    if (sbn.packageName !in allowedPackages(context)) {
      rememberSeenApp(context, prefs, sbn.packageName)
      return
    }

    // The same text again (a re-post, or the listener reconnecting) is not a new payment: the
    // texts carry the time, 누적 or 잔액, which change from one payment to the next.
    val id = hash("${sbn.packageName}\n$whole")
    val recent = readArray(prefs, KEY_RECENT)
    for (i in 0 until recent.length()) if (recent.getString(i) == id) return

    val entry = JSONObject()
      .put("id", id)
      .put("packageName", sbn.packageName)
      .put("appName", appName(context, sbn.packageName))
      .put("title", title)
      .put("text", text)
      .put("postedAt", sbn.postTime)
    val pending = readArray(prefs, KEY_PENDING).apply { put(entry) }
    val trimmed = JSONArray()
    for (i in maxOf(0, pending.length() - MAX_PENDING) until pending.length()) trimmed.put(pending.get(i))
    recent.put(id)
    val recentTrimmed = JSONArray()
    for (i in maxOf(0, recent.length() - MAX_RECENT) until recent.length()) recentTrimmed.put(recent.get(i))
    prefs.edit()
      .putString(KEY_PENDING, trimmed.toString())
      .putString(KEY_RECENT, recentTrimmed.toString())
      .apply()
    onCaptured?.invoke()
  }

  /** An app not on the list sent a payment-like notice: remember only its name, to offer it. */
  private fun rememberSeenApp(context: Context, prefs: SharedPreferences, packageName: String) {
    val seen = readArray(prefs, KEY_SEEN)
    val next = JSONArray()
    for (i in 0 until seen.length()) {
      val item = seen.getJSONObject(i)
      if (item.optString("packageName") != packageName) next.put(item)
    }
    next.put(
      JSONObject()
        .put("packageName", packageName)
        .put("appName", appName(context, packageName))
        .put("lastSeen", System.currentTimeMillis()),
    )
    val trimmed = JSONArray()
    for (i in maxOf(0, next.length() - MAX_SEEN) until next.length()) trimmed.put(next.get(i))
    prefs.edit().putString(KEY_SEEN, trimmed.toString()).apply()
  }

  @Synchronized
  fun pending(context: Context): List<Map<String, Any>> {
    val array = readArray(prefs(context), KEY_PENDING)
    return (0 until array.length()).map { i ->
      val item = array.getJSONObject(i)
      mapOf(
        "id" to item.optString("id"),
        "packageName" to item.optString("packageName"),
        "appName" to item.optString("appName"),
        "title" to item.optString("title"),
        "text" to item.optString("text"),
        "postedAt" to item.optLong("postedAt").toDouble(),
      )
    }
  }

  /** The app took these into its 대기함: drop them from the queue. */
  @Synchronized
  fun remove(context: Context, ids: List<String>) {
    val prefs = prefs(context)
    val array = readArray(prefs, KEY_PENDING)
    val next = JSONArray()
    for (i in 0 until array.length()) {
      val item = array.getJSONObject(i)
      if (item.optString("id") !in ids) next.put(item)
    }
    prefs.edit().putString(KEY_PENDING, next.toString()).apply()
  }

  @Synchronized
  fun seenApps(context: Context): List<Map<String, Any>> {
    val array = readArray(prefs(context), KEY_SEEN)
    return (0 until array.length()).map { i ->
      val item = array.getJSONObject(i)
      mapOf(
        "packageName" to item.optString("packageName"),
        "appName" to item.optString("appName"),
        "lastSeen" to item.optLong("lastSeen").toDouble(),
      )
    }
  }
}
