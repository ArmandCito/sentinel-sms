package expo.modules.sentinelsms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Queue of analysed SMS waiting for the JS layer to pick them up (app was closed). */
object PendingStore {
  private const val PREFS = "sentinel_pending"
  private const val KEY = "records"
  private const val MAX = 100

  @Synchronized
  fun add(ctx: Context, record: JSONObject) {
    val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val arr = try { JSONArray(p.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
    arr.put(record)
    val trimmed = JSONArray()
    val start = maxOf(0, arr.length() - MAX)
    for (i in start until arr.length()) trimmed.put(arr.get(i))
    p.edit().putString(KEY, trimmed.toString()).apply()
  }

  /** Returns the queued records as a JSON array string and empties the queue. */
  @Synchronized
  fun drain(ctx: Context): String {
    val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val value = p.getString(KEY, "[]") ?: "[]"
    p.edit().putString(KEY, "[]").apply()
    return value
  }
}

/** In-process hook so a running JS app is told immediately (set by the module while alive). */
object SentinelBridge {
  @Volatile var listener: ((String) -> Unit)? = null
}
