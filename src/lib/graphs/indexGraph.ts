import { Annotation, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { DOCS_NS } from "../store";
import { getVectorStore } from "../vectorstore";

export type IngestDoc = {
  id: string;
  text: string;
  url?: string;
  metadata?: Record<string, any>;
};

const IndexState = Annotation.Root({
  docs: Annotation<IngestDoc[]>(),
  count: Annotation<number>()
});

async function indexNode(
  state: typeof IndexState.State,
  config: LangGraphRunnableConfig
) {
  const store = config.store;
  if (!store) throw new Error("Missing store in config");

  // 1) Optional: keep KV copy in LangGraph Store (useful for debugging / fallbacks)
  let n = 0;
  for (const d of state.docs) {
    await store.put(DOCS_NS as unknown as string[], d.id, {
      text: d.text,
      url: d.url,
      metadata: d.metadata ?? {}
    });
    n++;
  }

  // 2) Add to Neon (pgvector) for semantic retrieval
  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(
    state.docs.map((d) => ({
      pageContent: d.text,
      metadata: {
        id: d.id,        // keep original id for citations
        url: d.url ?? null,
        ...(d.metadata ?? {})
      }
    }))
  );

  return { count: n };
}

export const indexGraph = new StateGraph(IndexState)
  .addNode("index", indexNode)
  .addEdge("__start__", "index")
  .addEdge("index", "__end__")
  .compile();
