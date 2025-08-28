export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { indexGraph } from "@/lib/graphs/indexGraph";
import { store } from "@/lib/store";
import { splitIntoDocs } from "@/lib/chunk";

// PDF text extraction using pdf-parse per docs (ESM-friendly import)
async function extractPdfText(data: Uint8Array): Promise<string> {
  // Prefer ESM entry; fall back to CJS default if needed
  let pdf: (input: Uint8Array, opts?: any) => Promise<any>;
  try {
    // ESM path recommended in docs/issues for ESM bundlers
    pdf = (await import("pdf-parse/lib/pdf-parse.js")).default as any;
  } catch {
    pdf = (await import("pdf-parse")).default as any;
  }
  const result = await pdf(data);
  return (result?.text ?? "").trim();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files");

  if (!files || files.length === 0) {
    return new Response(
      JSON.stringify({ error: "Attach at least one file under field 'files'" }),
      { status: 400 }
    );
  }

  const allDocs: any[] = [];
  let fileCount = 0;

  for (const f of files) {
    if (!(f instanceof File)) continue;
    fileCount++;

    const name = f.name || "file";
    const ext = name.split(".").pop()?.toLowerCase();

    let text = "";
    try {
      if (ext === "pdf") {
        // Per pdf-parse guidance, pass binary data (Uint8Array)
        const uint8 = new Uint8Array(await f.arrayBuffer());
        text = await extractPdfText(uint8);
      } else {
        // Best-effort: treat everything else as text
        text = await f.text();
      }
    } catch (e) {
      console.error("Failed to read file", name, e);
      continue; // skip this file but continue with others
    }

    if (!text.trim()) continue;

    const baseId = `${Date.now()}_${name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}`;
    const docs = await splitIntoDocs(text, baseId, undefined, {
      filename: name,
      ext
    });
    allDocs.push(...docs);
  }

  if (allDocs.length === 0) {
    return new Response(
      JSON.stringify({ error: "No text extracted from uploaded files." }),
      { status: 400 }
    );
  }

  const result = await indexGraph.invoke({ docs: allDocs }, { store });
  return new Response(
    JSON.stringify({
      ok: true,
      files: fileCount,
      chunks: allDocs.length,
      indexed: result.count
    }),
    { headers: { "content-type": "application/json" } }
  );
}
