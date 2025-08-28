import { Annotation, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { llm } from "../llm";
import { DOCS_NS } from "../store";

export type Citation = { id: string; url?: string; score?: number };

const SearchState = Annotation.Root({
  question: Annotation<string>(),
  retrieved: Annotation<{ id: string; text: string; url?: string; score: number }[]>(),
  answer: Annotation<string>(),
  citations: Annotation<Citation[]>()
});

async function retrieveNode(
  state: typeof SearchState.State,
  config: LangGraphRunnableConfig
) {
  const store = config.store;
  if (!store) throw new Error("Missing store in config");

  const results = await store.search(DOCS_NS as unknown as string[], {
    query: state.question,
    limit: 5
  });

  const retrieved = results.map((r: any) => ({
    id: r.key,
    text: r.value?.text ?? "",
    url: r.value?.url,
    score: r.score ?? 0
  }));

  return { retrieved };
}

async function generateNode(state: typeof SearchState.State) {
  const context = state.retrieved
    .map((d, i) => `[[${i + 1}]] ${d.text}`)
    .join("\n---\n");

  const messages = [
    new SystemMessage(
      `You are a concise assistant. Answer using ONLY the provided context. If the answer isn't in the context, say you don't know.`
    ),
    new HumanMessage(
      `Question: ${state.question}\n\nContext:\n${context}`
    )
  ];

  const completion = await llm.invoke(messages);

  const citations = state.retrieved.map((d) => ({ id: d.id, url: d.url, score: d.score }));

  return { answer: String(completion.content ?? ""), citations };
}

export const searchGraph = new StateGraph(SearchState)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__")
  .compile(); // supply `store` at invoke time
