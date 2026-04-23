export default {
  async fetch(): Promise<Response> {
    return Response.json({ ok: true, worker: "jinshi-market-brief-worker", status: "scaffold" });
  }
};
