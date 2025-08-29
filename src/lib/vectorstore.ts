// lib/vectorstore.ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { embeddings } from "./llm";

/**
 * Singleton Neon vector store (pgvector).
 * - Uses the same OpenAI embeddings instance as the rest of the app.
 * - Creates table automatically if it doesn't exist.
 */
let _vectorStorePromise: Promise<InstanceType<typeof NeonPostgres>> | null = null;

export function getVectorStore() {
  if (!_vectorStorePromise) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Missing DATABASE_URL for Neon Postgres");
    _vectorStorePromise = NeonPostgres.initialize(embeddings as OpenAIEmbeddings, {
      connectionString,
      // Optional overrides:
      // tableName: "documents",
      // schema: "public",
      // columns: { idColumnName: "id", vectorColumnName: "embedding", contentColumnName: "content", metadataColumnName: "metadata" }
    }) as any;
  }
  return _vectorStorePromise;
}
