package expo.modules.sentinelsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/** Entry point: fires for every incoming SMS, even if the app process is dead or the screen is off. */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val appCtx = context.applicationContext
    if (!ConfigStore.load(appCtx).protectionEnabled) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (messages.isNullOrEmpty()) return
    // Multipart SMS arrive as several PDUs: stitch them together.
    val sender = messages[0].displayOriginatingAddress ?: "Unknown"
    val body = messages.joinToString("") { it.displayMessageBody ?: "" }
    val timestamp = messages[0].timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
    if (body.isBlank()) return

    // goAsync() keeps the receiver alive (~10s) so the network call can finish off the main thread.
    val pending = goAsync()
    Thread {
      try {
        Pipeline.process(appCtx, sender, body, timestamp)
      } catch (t: Throwable) {
        Log.e("SentinelSms", "Failed to analyse incoming SMS", t)
      } finally {
        pending.finish()
      }
    }.start()
  }
}
