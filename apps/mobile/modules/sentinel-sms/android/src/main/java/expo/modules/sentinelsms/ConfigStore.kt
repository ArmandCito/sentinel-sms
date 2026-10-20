package expo.modules.sentinelsms

import android.content.Context
import java.util.UUID

/** Settings pushed from the JS layer. Stored natively so the receiver works when the app is closed. */
data class SentinelConfig(
  val protectionEnabled: Boolean,
  val onlineEnabled: Boolean,
  val apiUrl: String,
  val apiKey: String,
  /** Minimum final score that triggers a notification (65 = danger only, 35 = caution too). */
  val notifyMin: Int
)

object ConfigStore {
  private const val PREFS = "sentinel_prefs"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun save(ctx: Context, c: SentinelConfig) {
    prefs(ctx).edit()
      .putBoolean("protectionEnabled", c.protectionEnabled)
      .putBoolean("onlineEnabled", c.onlineEnabled)
      .putString("apiUrl", c.apiUrl.trim().trimEnd('/'))
      .putString("apiKey", c.apiKey.trim())
      .putInt("notifyMin", c.notifyMin)
      .apply()
  }

  fun load(ctx: Context): SentinelConfig {
    val p = prefs(ctx)
    return SentinelConfig(
      protectionEnabled = p.getBoolean("protectionEnabled", true),
      onlineEnabled = p.getBoolean("onlineEnabled", false),
      apiUrl = p.getString("apiUrl", "") ?: "",
      apiKey = p.getString("apiKey", "") ?: "",
      notifyMin = p.getInt("notifyMin", 65)
    )
  }

  /** Anonymous random id, generated once. Never derived from the phone number or IMEI. */
  fun deviceId(ctx: Context): String {
    val p = prefs(ctx)
    p.getString("deviceId", null)?.let { return it }
    val id = UUID.randomUUID().toString()
    p.edit().putString("deviceId", id).apply()
    return id
  }
}
