package expo.modules.sentinelsms

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.util.regex.Pattern

data class RuleHit(val id: String, val label: String, val category: String, val weight: Int)
data class OfflineResult(val score: Int, val hits: List<RuleHit>)

/**
 * Native twin of apps/mobile/src/services/ruleEngine.ts and the Python heuristics.
 * Reads the SAME rules file (assets/sentinel_rules.json, synced from packages/contracts/rules.json).
 */
object RuleEngine {
  private const val TAG = "SentinelRules"

  private data class Compiled(val hit: RuleHit, val pattern: Pattern)

  @Volatile private var rules: List<Compiled>? = null
  @Volatile var cautionThreshold = 35
    private set
  @Volatile var dangerThreshold = 65
    private set

  private fun load(ctx: Context): List<Compiled> {
    rules?.let { return it }
    synchronized(this) {
      rules?.let { return it }
      val text = ctx.assets.open("sentinel_rules.json").bufferedReader().use { it.readText() }
      val root = JSONObject(text)
      root.optJSONObject("thresholds")?.let {
        cautionThreshold = it.optInt("caution", 35)
        dangerThreshold = it.optInt("danger", 65)
      }
      val arr = root.getJSONArray("rules")
      val list = ArrayList<Compiled>(arr.length())
      for (i in 0 until arr.length()) {
        val r = arr.getJSONObject(i)
        try {
          var flags = 0
          if (r.optString("flags").contains('i')) flags = Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
          list.add(
            Compiled(
              RuleHit(r.getString("id"), r.getString("label"), r.getString("category"), r.getInt("weight")),
              Pattern.compile(r.getString("pattern"), flags)
            )
          )
        } catch (e: Exception) {
          // One bad rule must never disable protection.
          Log.e(TAG, "Skipping invalid rule at index $i", e)
        }
      }
      rules = list
      return list
    }
  }

  fun analyze(ctx: Context, body: String): OfflineResult {
    val hits = ArrayList<RuleHit>()
    var total = 0
    for (c in load(ctx)) {
      if (c.pattern.matcher(body).find()) {
        hits.add(c.hit)
        total += c.hit.weight
      }
    }
    return OfflineResult(total.coerceIn(0, 100), hits)
  }

  fun verdictFor(ctx: Context, score: Int): String {
    load(ctx) // ensures thresholds are loaded
    return when {
      score >= dangerThreshold -> "danger"
      score >= cautionThreshold -> "caution"
      else -> "safe"
    }
  }
}
