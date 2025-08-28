import { NextRequest } from "next/server";
import { indexGraph } from "@/lib/graphs/indexGraph";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const docs = (body?.docs ?? []).slice(0, 5_000); // safety cap

  if (!Array.isArray(docs) || docs.length === 0) {
    return new Response(JSON.stringify({ error: "Provide { docs: [{id,text,url?,metadata?}, ...] }" }), { status: 400 });
  }

  const result = await indexGraph.invoke({ docs }, { store });
  return new Response(JSON.stringify({ ok: true, indexed: result.count }), {
    headers: { "content-type": "application/json" }
  });
}
