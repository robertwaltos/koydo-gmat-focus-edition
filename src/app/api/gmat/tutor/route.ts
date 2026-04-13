import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EXAM_ID = "gmat";
const EXAM_DISPLAY_NAME = "GMAT Focus Edition";

const TUTOR_SYSTEM_PROMPT = `You are an expert AI tutor for ${EXAM_DISPLAY_NAME}. Respond in English.

Cover Quantitative Reasoning, Verbal Reasoning, and Data Insights (DSA, MSR, TPA, BI). Align to GMAC Focus Edition blueprint. Use logical, step-by-step breakdowns.

Core tutoring principles:
- Diagnose the student's specific misconception before explaining.
- Break down complex concepts into clear, manageable steps.
- Use concrete examples, analogies, and worked solutions.
- Encourage the student with positive, constructive feedback.
- Never give answers directly for practice questions — guide through reasoning.
- Keep responses focused and appropriately concise for a study session.`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const enc = new TextEncoder();

function sseChunk(ctrl: ReadableStreamDefaultController<Uint8Array>, data: string) {
  ctrl.enqueue(enc.encode(`data: ${data}\n\n`));
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json(
      { error: "A premium subscription is required to use the AI tutor." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages: { role: string; content: string }[] = body.messages.slice(-20);
  const qc = body.questionContext;

  let systemPrompt = TUTOR_SYSTEM_PROMPT;
  if (qc?.stem) {
    systemPrompt += `\n\nCurrent question:\nSubject: ${qc.subject ?? EXAM_DISPLAY_NAME}\nQuestion: ${qc.stem}`;
    if (Array.isArray(qc.options) && qc.options.length > 0) {
      systemPrompt += `\nOptions: ${(qc.options as { id: string; text: string }[]).map((o) => `${o.id}. ${o.text}`).join(" | ")}`;
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service is currently unavailable." }, { status: 503 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const killswitch = setTimeout(() => {
        try { controller.close(); } catch { /* ignore */ }
      }, 29_000);

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            stream: true,
            max_tokens: 1024,
            temperature: 0.7,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          }),
        });

        if (!res.ok || !res.body) {
          sseChunk(controller, JSON.stringify({ error: "AI provider error." }));
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") {
              sseChunk(controller, "[DONE]");
              return;
            }
            try {
              const delta = (JSON.parse(raw) as { choices: { delta: { content?: string } }[] })
                .choices?.[0]?.delta?.content;
              if (delta) sseChunk(controller, JSON.stringify({ choices: [{ delta: { content: delta } }] }));
            } catch { /* skip malformed chunk */ }
          }
        }
        sseChunk(controller, "[DONE]");
      } catch (err) {
        console.error(`[${EXAM_ID}:tutor]`, err);
        sseChunk(controller, JSON.stringify({ error: "An unexpected error occurred." }));
      } finally {
        clearTimeout(killswitch);
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
