package expo.modules.sentinelsms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/** JS-facing API of the native SMS engine. */
class SentinelSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SentinelSms")

    Events("onSmsAnalyzed")

    OnCreate {
      SentinelBridge.listener = { json -> sendEvent("onSmsAnalyzed", mapOf("json" to json)) }
    }
    OnDestroy {
      SentinelBridge.listener = null
    }

    Function("configure") { protectionEnabled: Boolean, onlineEnabled: Boolean, apiUrl: String, apiKey: String, notifyMin: Int ->
      ConfigStore.save(context, SentinelConfig(protectionEnabled, onlineEnabled, apiUrl, apiKey, notifyMin))
    }

    Function("getDeviceId") { ConfigStore.deviceId(context) }

    /** Returns a JSON array (string) of messages analysed while the app was closed. */
    Function("drainPending") { PendingStore.drain(context) }

    /** Reads the latest inbox messages (needs READ_SMS). Returns a JSON array string. */
    Function("readInbox") { limit: Int ->
      val ctx = context
      val out = JSONArray()
      if (ctx.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
        val projection = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
        ctx.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, projection, null, null, "date DESC")?.use { c ->
          val a = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
          val b = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
          val d = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
          var n = 0
          while (c.moveToNext() && n < limit) {
            out.put(JSONObject().put("sender", c.getString(a) ?: "Unknown").put("body", c.getString(b) ?: "").put("date", c.getLong(d)))
            n++
          }
        }
      }
      out.toString()
    }

    /** Runs the full native pipeline (rules + AI + notification) without a real SMS. For testing. */
    AsyncFunction("simulateSms") { sender: String, body: String ->
      Pipeline.process(context, sender, body, System.currentTimeMillis(), "simulated").toString()
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatterySettings") {
      launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    Function("openAppSettings") {
      launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }
  }

  private fun launch(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
