import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { IngestDoc } from "./graphs/indexGraph";


const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150
});


export async function splitIntoDocs(
  text: string,
  baseId: string,
  url?: string,
  extraMeta: Record<string, any> = {}
): Promise<IngestDoc[]> {
  const chunks = await splitter.splitText(text);
  return chunks.map((chunk, i) => ({
    id: `${baseId}__${String(i).padStart(4, "0")}`,
    text: chunk,
    url,
    metadata: { ...extraMeta, chunk: i }
  }));
}
