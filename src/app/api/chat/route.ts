import { NextRequest } from "next/server";
import { searchGraph } from "@/lib/graphs/searchGraph";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "Provide { question: string }" }), { status: 400 });
  }

  const out = await searchGraph.invoke({ question }, { store });
  return new Response(
    JSON.stringify({ answer: out.answer, citations: out.citations }),
    { headers: { "content-type": "application/json" } }
  );
}
