import { parseConfig } from "./config";
import { insertDigestRun, listRecentDigestRuns, markDigestRunPushed } from "./db";
import { authorizeAdminRequest } from "./lib/admin";
import { buildDigestMessage, buildFailureAlertMessage, buildFallbackMessage, buildHeartbeatMessage } from "./lib/message";
import { getRuntimeState, recordFailure, recordSuccess, setRuntimeState, shouldSendFailureAlert, shouldSendHeartbeat } from "./lib/runtime";
import { pushToFeishu } from "./services/feishu";
import { fetchJinshiSnapshot } from "./services/jinshi";
import { analyzeWithLLM } from "./services/llm";
import type { BriefConfig, Env, JinshiDigestItem, RuntimeState } from "./types";

async function runBrief(env: Env): Promise<{ itemCount: number; aiAnalysis: boolean }> {
  const config = parseConfig(env);
  const state = await getRuntimeState(env.RUNTIME_KV);
  const now = new Date();

  try {
    const result = await buildBrief(config, now);
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

    try {
      await pushToFeishu(config, result.message);
      await markDigestRunPushed(env.BRIEF_DB, runId, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markDigestRunPushed(env.BRIEF_DB, runId, false, message);
      throw error;
    }

    let nextState = recordSuccess(state, now);
    if (shouldSendHeartbeat(nextState, config.heartbeatIntervalHours, now)) {
      try {
        await pushToFeishu(config, buildHeartbeatMessage(nextState, config.heartbeatIntervalHours));
        nextState = { ...nextState, lastHeartbeatAt: now.toISOString() };
      } catch {
        // Heartbeat should not fail the main digest flow.
      }
    }
    await setRuntimeState(env.RUNTIME_KV, nextState);
    return { itemCount: result.items.length, aiAnalysis: result.aiAnalysis };
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

async function buildBrief(config: BriefConfig, now: Date): Promise<{ items: JinshiDigestItem[]; message: string; analysis?: string; aiAnalysis: boolean }> {
  const snapshot = await fetchJinshiSnapshot(config, now);
  if (snapshot.items.length === 0) {
    throw new Error("Jinshi snapshot returned no items");
  }

  try {
    const analysis = await analyzeWithLLM(config, snapshot.items);
    return {
      items: snapshot.items,
      message: buildDigestMessage(analysis, snapshot.items, now),
      analysis,
      aiAnalysis: true
    };
  } catch (error) {
    console.error("LLM analyze failed", error instanceof Error ? error.message : String(error));
    return {
      items: snapshot.items,
      message: buildFallbackMessage(snapshot.items, now),
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
