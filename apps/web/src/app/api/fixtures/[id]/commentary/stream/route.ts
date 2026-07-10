import { eq, asc } from "drizzle-orm";
import { matchCommentary } from "@rugby365/db";
import { getDb } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let lastSeen = new Date(0);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        const db = getDb();
        const lines = await db
          .select()
          .from(matchCommentary)
          .where(eq(matchCommentary.fixtureId, id))
          .orderBy(asc(matchCommentary.publishedAt));

        for (const line of lines) {
          if (line.publishedAt && line.publishedAt > lastSeen) {
            send({ type: "commentary.append", line });
            lastSeen = line.publishedAt;
          }
        }
      };

      await poll();
      const interval = setInterval(async () => {
        try {
          await poll();
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
