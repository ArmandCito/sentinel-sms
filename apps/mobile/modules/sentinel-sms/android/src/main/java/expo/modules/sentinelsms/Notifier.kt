package expo.modules.sentinelsms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Color
import android.os.Build
import org.json.JSONObject

/** High-priority heads-up alerts, posted natively so they work with the app closed. */
object Notifier {
  private const val CHANNEL_ID = "sentinel_alerts"

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Scam alerts", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Alerts for suspicious or phishing SMS"
      enableVibration(true)
      enableLights(true)
      lightColor = Color.RED
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }
    nm.createNotificationChannel(channel)
  }

  @Suppress("DEPRECATION")
  fun show(ctx: Context, notifId: Int, record: JSONObject) {
    try {
      ensureChannel(ctx)
      val verdict = record.optString("verdict")
      val sender = record.optString("sender", "Unknown")
      val score = record.optInt("finalScore")
      val danger = verdict == "danger"

      val title = if (danger) "Phishing risk from $sender" else "Suspicious SMS from $sender"
      val summary = record.optString("aiSummary").ifBlank {
        val hits = record.optJSONArray("hits")
        val labels = ArrayList<String>()
        if (hits != null) for (i in 0 until hits.length()) {
          val h = hits.getJSONObject(i)
          if (h.optInt("weight") > 0) labels.add(h.optString("label"))
        }
        labels.take(2).joinToString(". ").ifBlank { "Do not click links or reply." }
      }
      val text = "Risk $score/100. $summary"

      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pending = launch?.let {
        PendingIntent.getActivity(ctx, notifId, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(ctx, CHANNEL_ID)
      } else {
        Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
      }
      builder
        .setSmallIcon(android.R.drawable.ic_dialog_alert)
        .setContentTitle(title)
        .setContentText(text)
        .setStyle(Notification.BigTextStyle().bigText(text))
        .setColor(if (danger) Color.parseColor("#EF4444") else Color.parseColor("#F59E0B"))
        .setCategory(Notification.CATEGORY_MESSAGE)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
        .setOnlyAlertOnce(true) // the AI refinement updates the alert silently
        .setAutoCancel(true)
      pending?.let { builder.setContentIntent(it) }

      (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(notifId, builder.build())
    } catch (e: Exception) {
      android.util.Log.e("SentinelNotifier", "Could not show notification", e)
    }
  }

  fun cancel(ctx: Context, notifId: Int) {
    (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(notifId)
  }
}
