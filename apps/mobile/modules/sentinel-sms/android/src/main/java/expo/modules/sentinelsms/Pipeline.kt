package expo.modules.sentinelsms

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * The whole hybrid analysis, executed natively:
 *  1. Instant offline score (rules).
 *  2. Immediate alert if already risky.
 *  3. Online AI refinement when internet + backend are available (alert is updated in place).
 *  4. Persist for the JS layer and notify it if it is running.
 */
object Pipeline {
  private const val TAG = "SentinelPipeline"

  fun process(ctx: Context, sender: String, body: String, receivedAt: Long, origin: String = "sms"): JSONObject {
    val cfg = ConfigStore.load(ctx)
    val id = UUID.randomUUID().toString()
    val notifId = id.hashCode()

    val offline = RuleEngine.analyze(ctx, body)
    var finalScore = offline.score
    var aiScore: Int? = null
    var summary: String? = null
    var reasons: List<String> = emptyList()
    var provider: String? = null
    var source = "offline"

    fun build(): JSONObject {
      val hits = JSONArray()
      offline.hits.forEach {
        hits.put(JSONObject().put("id", it.id).put("label", it.label).put("category", it.category).put("weight", it.weight))
      }
      return JSONObject()
        .put("id", id)
        .put("sender", sender)
        .put("body", body)
        .put("receivedAt", receivedAt)
        .put("offlineScore", offline.score)
        .put("aiScore", aiScore ?: JSONObject.NULL)
        .put("finalScore", finalScore)
        .put("verdict", RuleEngine.verdictFor(ctx, finalScore))
        .put("hits", hits)
        .put("aiSummary", summary ?: JSONObject.NULL)
        .put("aiReasons", JSONArray(reasons))
        .put("source", source)
        .put("provider", provider ?: JSONObject.NULL)
        .put("origin", origin)
    }

    var notified = false
    if (finalScore >= cfg.notifyMin) {
      Notifier.show(ctx, notifId, build())
      notified = true
    }

    if (cfg.onlineEnabled && cfg.apiUrl.isNotBlank() && ApiClient.isOnline(ctx)) {
      val ai = ApiClient.analyze(cfg, ConfigStore.deviceId(ctx), sender, body)
      if (ai != null) {
        aiScore = ai.aiScore
        finalScore = ai.finalScore
        summary = ai.summary
        reasons = ai.reasons
        provider = ai.provider
        source = "hybrid"
        if (finalScore >= cfg.notifyMin) {
          Notifier.show(ctx, notifId, build()) // same id: updates the earlier alert
        } else if (notified) {
          Notifier.cancel(ctx, notifId) // AI judged it a false alarm
        }
      }
    }

    val record = build()
    try {
      PendingStore.add(ctx, record)
      SentinelBridge.listener?.invoke(record.toString())
    } catch (e: Exception) {
      Log.e(TAG, "Could not hand the record over to JS", e)
    }
    return record
  }
}
