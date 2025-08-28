"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; citations?: { id: string; url?: string; score?: number }[] };

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);

  async function send() {
    const q = input.trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const data = await r.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? "", citations: data.citations ?? [] }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    setUploading(true);
    setUploadInfo(null);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data?.ok) setUploadInfo(`Indexed ${data.chunks} chunks from ${data.files} file(s).`);
      else setUploadInfo(data?.error ?? "Upload failed.");
    } catch (err) {
      setUploadInfo("Upload failed.");
    } finally {
      setUploading(false);
      // reset input so the same files can be re-selected
      e.target.value = "";
    }
  }

  return (
    <main className="min-h-dvh max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Open RAG Chat</h1>

      {/* Upload card */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Upload documents (txt, md, csv, json, pdf)</h2>
        <p className="text-sm text-neutral-500">Files are split into ~1k‑token chunks and indexed for retrieval (top‑5).</p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.pdf"
            onChange={onUpload}
          />
          {uploading && <span className="text-sm">Uploading…</span>}
          {uploadInfo && <span className="text-sm text-neutral-600">{uploadInfo}</span>}
        </div>
      </section>

      {/* Chat card */}
      <section className="border rounded-xl p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">Ask anything. Answers are generated from the indexed documents when possible. Citations appear under each reply.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={`inline-block px-3 py-2 rounded-2xl max-w-full whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-100"}`}>
              {m.content}
            </div>
            {m.role === "assistant" && m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.citations.map((c, j) => (
                  <a
                    key={j}
                    target="_blank"
                    rel="noreferrer"
                    href={c.url || `#doc-${c.id}`}
                    className="text-xs underline decoration-dotted hover:opacity-80"
                    title={c.url || c.id}
                  >
                    [#{j + 1}] {c.url ? new URL(c.url).hostname : c.id}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-full px-4 py-2 outline-none"
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={loading}
          className="px-4 py-2 rounded-full bg-black text-white disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </main>
  );
}
