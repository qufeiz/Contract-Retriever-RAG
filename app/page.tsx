"use client";
import { useState, useRef, useEffect } from "react";

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

// Per-feature entry points — color-coded so the surface reads as "many capabilities".
const EXAMPLES: { feat: string; chip: string; q: string }[] = [
  {
    feat: "Contract Intelligence",
    chip: "var(--sql)",
    q: "What contracts expire in the next 90 days and what penalties are defined in those contracts?",
  },
  {
    feat: "Case File Q&A",
    chip: "var(--pdf)",
    q: "What was the final child support amount, and who got primary residence in the Carter case?",
  },
  {
    feat: "Case File Q&A",
    chip: "var(--pdf)",
    q: "When did Joni Carter file for divorce?",
  },
  {
    feat: "Maintenance Spend",
    chip: "var(--gold)",
    q: "Which customers have overdue payments and what does the agreement say about service suspension?",
  },
  {
    feat: "Maintenance Spend",
    chip: "var(--gold)",
    q: "How much did we spend on maintenance in 2026, and which vendors cost the most overall?",
  },
  {
    feat: "Contract Intelligence · עברית",
    chip: "var(--sql)",
    q: "אילו חוזים יפוגו ב-90 הימים הקרובים ומהם הקנסות המוגדרים באותם חוזים?",
  },
];

const CITE_RE = /(\[(?:S|P):[^\]#]+#\d+\])/g;
const isHebrew = (s: string) => /[֐-׿]/.test(s);

const sourceLabel = (s: string) => (s === "structured" ? "Structured · SQL" : "Documents · RAG");

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAllRows(false);
    setActiveCite(null);
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

  // Click a citation chip → reveal all rows, highlight + scroll to the source.
  function onCiteClick(token: string) {
    setShowAllRows(true);
    setActiveCite(token);
  }
  useEffect(() => {
    if (!activeCite) return;
    const el = document.getElementById(`src-${cssId(activeCite)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeCite, showAllRows]);

  function renderAnswer(text: string) {
    return text.split(CITE_RE).map((p, i) => {
      const m = p.match(/^\[(S|P):/);
      if (m) {
        const cls = m[1] === "S" ? "cite sql" : "cite pdf";
        return (
          <span
            key={i}
            className={`${cls}${activeCite === p ? " active" : ""}`}
            title="Click to trace this claim to its source"
            role="button"
            tabIndex={0}
            onClick={() => onCiteClick(p)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onCiteClick(p)}
          >
            {p}
          </span>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }

  const rows = result?.evidence.rows ?? [];
  const chunks = result?.evidence.chunks ?? [];
  const visibleRows = showAllRows ? rows : rows.slice(0, 5);
  const answerRtl = result ? isHebrew(result.answer) : false;

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="brand-row">
          <h1 className="wordmark">
            Aletheia<span className="dot">.</span>
          </h1>
          <span className="kicker">Knowledge Assistant</span>
        </div>
        <p className="tagline">
          Ask a business question in plain language. Aletheia <b>routes</b> it to the right source,
          answers with <b>hybrid SQL + document retrieval</b>, and attaches a <b>citation to every
          fact</b> you can trace to the exact row or page. Not a PDF chatbot — grounded, or it says
          so.
        </p>
      </header>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && !loading) ask(question.trim());
        }}
      >
        <span className="glyph" aria-hidden>
          ❧
        </span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about contracts, the case file, or maintenance spend…"
          aria-label="Ask a question"
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? <span className="spinner" /> : "Ask"}
        </button>
      </form>

      {!result && !loading && !error && (
        <>
          <p className="examples-label">Try a capability</p>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.q}
                className="example-card"
                style={{ ["--chip" as string]: ex.chip }}
                onClick={() => {
                  setQuestion(ex.q);
                  ask(ex.q);
                }}
              >
                <span className="feat">{ex.feat}</span>
                <span className="q" dir={isHebrew(ex.q) ? "rtl" : "ltr"}>
                  {ex.q}
                </span>
              </button>
            ))}
          </div>
          <p className="empty-hint">
            Every answer shows which source(s) it queried and a chip for each fact — click a chip to
            jump to the source.
          </p>
        </>
      )}

      {error && (
        <div className="card error-card">
          <h2>Something went wrong</h2>
          <p className="err">{error}</p>
          <p className="muted" style={{ marginTop: 8 }}>
            Try again, or ask a different question.
          </p>
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="thinking">
            <span className="spinner" />
            <span>
              Routing the question and retrieving evidence
              <span className="steps"> · route → retrieve → ground → cite → verify</span>
            </span>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="card" data-testid="route-panel">
            <h2>Routing decision</h2>
            <div className="route-flow">
              <span className="route-arrow">question</span>
              <span className="route-arrow">→</span>
              {result.route.sources.map((s, i) => (
                <span key={s} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  {i > 0 && <span className="route-arrow">+</span>}
                  <span className={`badge ${s}`} data-testid={`source-${s}`}>
                    {sourceLabel(s)}
                  </span>
                </span>
              ))}
            </div>
            <p className="rationale">{result.route.rationale}</p>
            {result.route.intents.length > 0 && (
              <p className="intent-list">
                intents: {result.route.intents.map((i) => i.name).join(" · ")}
              </p>
            )}
          </div>

          <div className="card">
            <h2>Answer</h2>
            <div
              className="answer"
              data-testid="answer"
              dir={answerRtl ? "rtl" : "ltr"}
              lang={answerRtl ? "he" : "en"}
            >
              {renderAnswer(result.answer)}
            </div>
            <div
              className={`validation ${result.validation.ok ? "ok" : "bad"}`}
              data-testid="validation"
            >
              <span className="mk">{result.validation.ok ? "✓" : "✗"}</span>
              <span>
                {result.validation.ok
                  ? "Grounded — every cited source resolves to retrieved evidence (validateAnswer passed)."
                  : "Rejected by validateAnswer(): " + result.validation.reasons.join("; ")}
              </span>
            </div>
          </div>

          <div className="card" data-testid="sources-panel" ref={sourcesRef}>
            <h2>
              Sources — {rows.length} row{rows.length === 1 ? "" : "s"} · {chunks.length} document
              chunk{chunks.length === 1 ? "" : "s"}
            </h2>

            {rows.length === 0 && chunks.length === 0 && (
              <p className="muted" style={{ fontStyle: "italic" }}>
                No sources were retrieved for this question — which is why the answer states what it
                cannot determine rather than guessing.
              </p>
            )}

            {visibleRows.map((r) => (
              <div
                className={`evidence-row${activeCite === r.token ? " highlight" : ""}`}
                key={r.token}
                id={`src-${cssId(r.token)}`}
              >
                <span className="tok sql">{r.token}</span>
                <div className="evidence-body">
                  <div className="meta">{r.table} · row {r.id}</div>
                  <span className="data">{prettyRow(r.data)}</span>
                </div>
              </div>
            ))}
            {rows.length > 5 && (
              <button className="more" onClick={() => setShowAllRows((v) => !v)}>
                {showAllRows ? "▴ Show fewer" : `▾ Show all ${rows.length} rows`}
              </button>
            )}

            {chunks.map((c) => (
              <div
                className={`evidence-row${activeCite === c.token ? " highlight" : ""}`}
                key={c.token}
                id={`src-${cssId(c.token)}`}
              >
                <span className="tok pdf">{c.token}</span>
                <div className="evidence-body">
                  <div className="meta">
                    {c.doc} · page {c.page}
                  </div>
                  <span className="data" dir={isHebrew(c.text) ? "rtl" : "ltr"}>
                    {c.text.slice(0, 240)}
                    {c.text.length > 240 ? "…" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="more"
            style={{ marginTop: 18 }}
            onClick={() => {
              setResult(null);
              setQuestion("");
            }}
          >
            ← Ask another question
          </button>
        </>
      )}

      <footer className="foot">
        <span>Aletheia · grounded knowledge assistant</span>
        <span className="sep">·</span>
        <a href="https://github.com/qufeiz/Contract-Retriever-RAG" target="_blank" rel="noreferrer">
          source
        </a>
        <span className="sep">·</span>
        <span>routing · hybrid SQL + RAG · cited &amp; verified</span>
      </footer>
    </div>
  );
}

// Stable DOM id from a citation token (so chips can scroll to their source row).
function cssId(token: string) {
  return token.replace(/[^a-zA-Z0-9]+/g, "-");
}

// Render a SQL row as readable "key: value · key: value" instead of raw JSON.
function prettyRow(data: Record<string, unknown>) {
  return Object.entries(data)
    .filter(([k]) => k !== "id" && !k.endsWith("_iso") && k !== "__malformed")
    .map(([k, v]) => `${k}: ${v ?? "—"}`)
    .join("  ·  ");
}
