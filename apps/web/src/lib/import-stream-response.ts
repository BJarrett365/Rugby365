import type { ImportProgressEvent } from "./import-progress-types";

export function createImportNdjsonStream<T>(
  run: (report: (event: ImportProgressEvent) => void) => Promise<T>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const result = await run((event) => {
          send({ type: "progress", event });
        });
        send({ type: "complete", result });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Import failed",
        });
      } finally {
        controller.close();
      }
    },
  });
}

export function importStreamResponse<T>(
  run: (report: (event: ImportProgressEvent) => void) => Promise<T>,
) {
  return new Response(createImportNdjsonStream(run), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
