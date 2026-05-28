import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  const file = await readFile(join(process.cwd(), "public", "wewe-rss.png"));

  return new Response(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
