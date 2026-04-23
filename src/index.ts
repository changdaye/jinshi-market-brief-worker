export default {
  async fetch(): Promise<Response> {
    return Response.json({ ok: true, worker: "jin10-market-brief-worker", status: "scaffold" });
  }
};
