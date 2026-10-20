package expo.modules.sentinelsms

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

data class AiResponse(
  val aiScore: Int?,
  val finalScore: Int,
  val verdict: String,
  val provider: String,
  val summary: String?,
  val reasons: List<String>
)

/** Minimal blocking HTTP client (runs on a worker thread inside the SMS broadcast window). */
object ApiClient {
  private const val TAG = "SentinelApi"
  // Worst case 3s + 5s = 8s, inside the ~10s budget Android gives a broadcast receiver.
  private const val CONNECT_TIMEOUT_MS = 3000
  private const val READ_TIMEOUT_MS = 5000

  fun isOnline(ctx: Context): Boolean {
    val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val net = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(net) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  fun analyze(cfg: SentinelConfig, deviceId: String, sender: String, body: String): AiResponse? {
    var conn: HttpURLConnection? = null
    return try {
      val url = URL(cfg.apiUrl.trimEnd('/') + "/api/v1/analyze/")
      conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = CONNECT_TIMEOUT_MS
        readTimeout = READ_TIMEOUT_MS
        doOutput = true
        setRequestProperty("Content-Type", "application/json; charset=utf-8")
        setRequestProperty("Accept", "application/json")
        if (cfg.apiKey.isNotBlank()) setRequestProperty("X-API-Key", cfg.apiKey)
      }
      val payload = JSONObject()
        .put("device_id", deviceId)
        .put("sender", sender)
        .put("body", body)
        .put("locale", Locale.getDefault().toLanguageTag())
      conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }

      if (conn.responseCode !in 200..299) {
        Log.w(TAG, "Backend answered HTTP ${conn.responseCode}")
        return null
      }
      val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
      val reasons = ArrayList<String>()
      json.optJSONArray("reasons")?.let { for (i in 0 until it.length()) reasons.add(it.optString(i)) }
      AiResponse(
        aiScore = if (json.isNull("ai_score")) null else json.optInt("ai_score"),
        finalScore = json.getInt("final_score"),
        verdict = json.getString("verdict"),
        provider = json.optString("provider", "unknown"),
        summary = json.optString("summary").ifBlank { null },
        reasons = reasons
      )
    } catch (e: Exception) {
      Log.w(TAG, "Online analysis failed: ${e.javaClass.simpleName}: ${e.message}")
      null
    } finally {
      conn?.disconnect()
    }
  }
}
