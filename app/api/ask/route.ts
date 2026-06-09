import { NextResponse } from "next/server";
import { answerQuestion } from "../../../lib/engine/answer.ts";
import { llmConfigured } from "../../../lib/engine/llm.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json(
      { error: "LLM_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }
  let question = "";
  try {
    const body = await req.json();
    question = (body?.question ?? "").toString().trim();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  try {
    const result = await answerQuestion(question);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
