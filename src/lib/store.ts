import { InMemoryStore } from "@langchain/langgraph";
import { embeddings } from "./llm";


// Long‑term memory store with semantic search (OpenAI embeddings, 1536 dims)
export const store = new InMemoryStore({
  index: {
    embeddings,
    dims: 1536,
// Only embed the `text` field from values
    fields: ["text"]
  }
});



// Namespaces
export const DOCS_NS = ["public", "docs"] as const;
