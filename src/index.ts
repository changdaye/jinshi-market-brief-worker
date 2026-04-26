import { parseConfig } from "./config";
import { insertDigestRun, listRecentDigestRuns, markDigestRunPushed } from "./db";
import { authorizeAdminRequest } from "./lib/admin";
import { buildDigestMessage, buildFailureAlertMessage, buildFallbackMessage, buildHeartbeatMessage, buildWakeSummaryMessage } from "./lib/message";
import { getRuntimeState, recordFailure, recordSuccess, setRuntimeState, shouldSendFailureAlert, shouldSendHeartbeat } from "./lib/runtime";
import { clearQuietDigest, isDigestQuietHours, noteQuietDigest } from "./lib/schedule";
import { pushToFeishu } from "./services/feishu";
import { uploadDetailedReportToCos } from "./services/cos";
import { fetchJinshiSnapshot } from "./services/jinshi";
import { analyzeWithLLM } from "./services/llm";
import { buildDetailedReport } from "./lib/report";
import { buildDetailedReportPublicUrl, maybeHandleDetailedReportRequest, saveDetailedReportCopy } from "./lib/report-storage";
import type { BriefConfig, Env, JinshiDigestItem, RuntimeState } from "./types";

async function runBrief(env: Env): Promise<{ itemCount: number; aiAnalysis: boolean; detailedReportUrl?: string }> {
  const config = parseConfig(env);
  const state = await getRuntimeState(env.RUNTIME_KV);
  const now = new Date();
  const quietHours = isDigestQuietHours(now);

  try {
    const result = await buildBrief(env, config, now);
    const detailedReport = buildDetailedReport(result.analysis ?? result.message, result.items, result.aiAnalysis, now);
    const uploaded = await uploadDetailedReportToCos(config, detailedReport, now);
    await saveDetailedReportCopy(env.RUNTIME_KV, uploaded.key, detailedReport);
    const publicReportUrl = buildDetailedReportPublicUrl(config.workerPublicBaseUrl, uploaded.key);
    const baseMessage = result.aiAnalysis
      ? buildDigestMessage(result.analysis ?? result.message, result.items, publicReportUrl, result.modelLabel ?? "")
      : buildFallbackMessage(result.items, publicReportUrl, result.modelLabel ?? "");
    result.message = !quietHours && (state.quietDigestCount ?? 0) > 0
      ? buildWakeSummaryMessage(baseMessage, state.quietDigestCount ?? 0)
      : baseMessage;
    result.detailedReportUrl = publicReportUrl;
    const runId = crypto.randomUUID();
    await insertDigestRun(env.BRIEF_DB, {
      id: runId,
      source: "jin10 public web snapshot",
      itemCount: result.items.length,
      aiAnalysis: result.aiAnalysis,
      messageText: result.message,
      analysisText: result.analysis,
      sourceItems: result.items,
      now
    });

    let nextState = recordSuccess(state, now);
    if (quietHours) {
      nextState = noteQuietDigest(nextState, now);
      await markDigestRunPushed(env.BRIEF_DB, runId, true);
      if (shouldSendHeartbeat(nextState, config.heartbeatIntervalHours, now)) {
        try {
          await pushToFeishu(config, buildHeartbeatMessage(nextState, config.heartbeatIntervalHours));
          nextState = { ...nextState, lastHeartbeatAt: now.toISOString() };
        } catch {
          // Heartbeat should not fail the main digest flow.
        }
      }
      await setRuntimeState(env.RUNTIME_KV, nextState);
      return { itemCount: result.items.length, aiAnalysis: result.aiAnalysis, detailedReportUrl: result.detailedReportUrl };
    }

    try {
      await pushToFeishu(config, result.message);
      await markDigestRunPushed(env.BRIEF_DB, runId, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markDigestRunPushed(env.BRIEF_DB, runId, false, message);
      throw error;
    }

    if ((nextState.quietDigestCount ?? 0) > 0) {
      nextState = clearQuietDigest(nextState);
    }
    if (shouldSendHeartbeat(nextState, config.heartbeatIntervalHours, now)) {
      try {
        await pushToFeishu(config, buildHeartbeatMessage(nextState, config.heartbeatIntervalHours));
        nextState = { ...nextState, lastHeartbeatAt: now.toISOString() };
      } catch {
        // Heartbeat should not fail the main digest flow.
      }
    }
    await setRuntimeState(env.RUNTIME_KV, nextState);
    return { itemCount: result.items.length, aiAnalysis: result.aiAnalysis, detailedReportUrl: result.detailedReportUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let nextState = recordFailure(state, message, now);
    if (shouldSendFailureAlert(nextState, config.failureAlertThreshold, config.failureAlertCooldownMinutes, now)) {
      try {
        await pushToFeishu(config, buildFailureAlertMessage(nextState, config.failureAlertThreshold));
        nextState = { ...nextState, lastAlertAt: now.toISOString() };
      } catch {
        // Keep the original failure as the primary signal.
      }
    }
    await setRuntimeState(env.RUNTIME_KV, nextState);
    throw error;
  }
}

async function buildBrief(env: Env, config: BriefConfig, now: Date): Promise<{ items: JinshiDigestItem[]; message: string; analysis?: string; modelLabel?: string; aiAnalysis: boolean; detailedReportUrl?: string }> {
  const snapshot = await fetchJinshiSnapshot(config, now);
  if (snapshot.items.length === 0) {
    throw new Error("Jinshi snapshot returned no items");
  }

  try {
    const llmResult = await analyzeWithLLM(config, env.AI, snapshot.items);
    return {
      items: snapshot.items,
      message: buildDigestMessage(llmResult.analysis, snapshot.items, undefined, llmResult.modelLabel),
      analysis: llmResult.analysis,
      modelLabel: llmResult.modelLabel,
      aiAnalysis: true
    };
  } catch (error) {
    console.error("LLM analyze failed", error instanceof Error ? error.message : String(error));
    return {
      items: snapshot.items,
      message: buildFallbackMessage(snapshot.items),
      aiAnalysis: false
    };
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return Response.json(data, { status });
}

async function buildHealthResponse(env: Env): Promise<Record<string, unknown>> {
  const runtimeState: RuntimeState = await getRuntimeState(env.RUNTIME_KV);
  const recentRuns = await listRecentDigestRuns(env.BRIEF_DB, 5);
  return {
    ok: true,
    worker: "jinshi-market-brief-worker",
    runtimeState,
    recentRuns
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const reportResponse = await maybeHandleDetailedReportRequest(request, env.RUNTIME_KV);
      if (reportResponse) return reportResponse;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse(await buildHealthResponse(env));
    }

    if (request.method === "POST" && url.pathname === "/admin/trigger") {
      const config = parseConfig(env);
      const auth = authorizeAdminRequest(request, config.manualTriggerToken);
      if (!auth.ok) {
        return jsonResponse({ ok: false, error: auth.error }, auth.status);
      }
      try {
        const result = await runBrief(env);
        return jsonResponse({ ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ ok: false, error: message }, 500);
      }
    }

    return jsonResponse({ ok: false, error: "not found" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runBrief(env);
  }
};
