import { Annotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { llm } from "../llm";
import { getVectorStore } from "../vectorstore";

export type Citation = { id: string; url?: string; score?: number };

const SearchState = Annotation.Root({
  question: Annotation<string>(),
  retrieved: Annotation<{ id: string; text: string; url?: string; score: number }[]>(),
  answer: Annotation<string>(),
  citations: Annotation<Citation[]>()
});

async function retrieveNode(state: typeof SearchState.State) {
  const vectorStore = await getVectorStore();

  // Returns [Document, score][]
  const results = await vectorStore.similaritySearchWithScore(state.question, 5);

  const retrieved = results.map(([doc, score]) => ({
    id: (doc.metadata as any)?.id ?? "",
    text: doc.pageContent ?? "",
    url: (doc.metadata as any)?.url ?? undefined,
    score: typeof score === "number" ? score : 0
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
    new HumanMessage(`Question: ${state.question}\n\nContext:\n${context}`)
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
  .compile();
