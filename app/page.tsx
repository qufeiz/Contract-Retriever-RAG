"use client";
import { useState } from "react";

type AnswerResult = {
  question: string;
  route: {
    sources: string[];
    intents: { name: string; params: Record<string, unknown> }[];
    docFilter: string | null;
    rationale: string;
  };
  answer: string;
  evidence: {
    rows: { table: string; id: number; token: string; data: Record<string, unknown> }[];
    chunks: { doc: string; page: number; token: string; text: string }[];
  };
  validation: { ok: boolean; reasons: string[] };
};

const EXAMPLES = [
  "What contracts expire in the next 90 days and what penalties are defined in those contracts?",
  "What did the court decide about custody and child support for the Carters?",
  "Why did the Carters get divorced?",
  "Show maintenance invoices completed before 2025 that may be overdue.",
];

// Render answer text, highlighting [S:table#id] / [P:doc#page] citation tokens.
function renderAnswer(text: string) {
  const parts = text.split(/(\[(?:S|P):[^\]#]+#\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(S|P):/);
    if (m) {
      const cls = m[1] === "S" ? "cite sql" : "cite pdf";
      return (
        <span key={i} className={cls} title="Resolvable source — see Sources below">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  async function ask(q: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAllRows(false);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setResult(data as AnswerResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.evidence.rows ?? [];
  const visibleRows = showAllRows ? rows : rows.slice(0, 5);

  return (
    <div className="wrap">
      <header>
        <h1>AI Business Knowledge Assistant</h1>
        <p className="sub">
          Ask a free-form business question. It is <strong>routed</strong> to the relevant source(s),
          answered with <strong>hybrid SQL + document retrieval</strong>, and returned with{" "}
          <strong>inline citations</strong> you can trace. Not a PDF chatbot — every fact is grounded.
        </p>
      </header>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && !loading) ask(question.trim());
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What contracts expire in the next 90 days?"
          aria-label="Ask a question"
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? <span className="spinner" /> : "Ask"}
        </button>
      </form>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
          >
            {ex.length > 60 ? ex.slice(0, 57) + "…" : ex}
          </button>
        ))}
      </div>

      {error && (
        <div className="card">
          <p className="error">Error: {error}</p>
        </div>
      )}

      {loading && (
        <div className="card">
          <p className="muted">
            <span className="spinner" /> Routing the question and retrieving evidence…
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="card" data-testid="route-panel">
            <h2>Routing decision</h2>
            <div className="route-badges">
              {result.route.sources.map((s) => (
                <span key={s} className={`badge ${s}`} data-testid={`source-${s}`}>
                  {s === "structured" ? "Structured · SQL" : "Documents · RAG"}
                </span>
              ))}
            </div>
            <p className="rationale">{result.route.rationale}</p>
            {result.route.intents.length > 0 && (
              <p className="intent-list">
                Structured intents: {result.route.intents.map((i) => i.name).join(", ")}
              </p>
            )}
          </div>

          <div className="card">
            <h2>Answer</h2>
            <div className="answer" data-testid="answer">
              {renderAnswer(result.answer)}
            </div>
            <div
              className={`validation ${result.validation.ok ? "ok" : "bad"}`}
              data-testid="validation"
            >
              {result.validation.ok
                ? "✓ Grounded — every cited source resolves to retrieved evidence."
                : "✗ Rejected by validateAnswer(): " + result.validation.reasons.join("; ")}
            </div>
          </div>

          <div className="card" data-testid="sources-panel">
            <h2>
              Sources ({rows.length} rows · {result.evidence.chunks.length} document chunks)
            </h2>
            {visibleRows.map((r) => (
              <div className="evidence-row" key={r.token}>
                <span className="tok sql">{r.token}</span>
                <span className="data">{JSON.stringify(r.data)}</span>
              </div>
            ))}
            {rows.length > 5 && (
              <button className="more" onClick={() => setShowAllRows((v) => !v)}>
                {showAllRows ? "Show fewer" : `Show all ${rows.length} rows`}
              </button>
            )}
            {result.evidence.chunks.map((c) => (
              <div className="evidence-row" key={c.token}>
                <span className="tok pdf">{c.token}</span>
                <span className="data">{c.text.slice(0, 220)}…</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
