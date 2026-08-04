"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Question = { id: number; questionText: string; answerType: string; sortOrder: number };
type Criterion = { id: number; name: string; description: string | null; questions: Question[] };
type Employee = { id: number; firstName: string; lastName: string; jobTitle: string | null; department: { name: string } };

type AISuggestion = { doWell: string; improve: string; stub?: boolean };
type AIStatus = "idle" | "loading" | "done" | "error";

export default function ReviewFormPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [ratings, setRatings] = useState<Record<number, number | string>>({});
  const [doWell, setDoWell] = useState("");
  const [improve, setImprove] = useState("");
  const [attention, setAttention] = useState("");
  const [wouldPick, setWouldPick] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // AI Suggestion state
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiDecision, setAiDecision] = useState<"accepted" | "edited" | "discarded" | null>(null);

  useEffect(() => {
    params.then((p) => {
      const id = Number(p.employeeId);
      setEmployeeId(id);
      fetchData(id);
    });
  }, []);

  async function fetchData(eid: number) {
    setLoading(true);
    const [empRes, criteriaRes, draftRes] = await Promise.all([
      fetch(`/api/employees/${eid}`),
      fetch("/api/criteria"),
      fetch(`/api/reviews/draft?employeeId=${eid}`),
    ]);
    if (empRes.ok) setEmployee(await empRes.json());
    if (criteriaRes.ok) setCriteria(await criteriaRes.json());
    if (draftRes.ok) {
      const draft = await draftRes.json();
      if (draft) {
        setDoWell(draft.doWellComment ?? "");
        setImprove(draft.improveComment ?? "");
        setAttention(draft.attentionComment ?? "");
        setWouldPick(draft.wouldPickForTeam ?? null);
        const r: Record<number, number | string> = {};
        for (const rating of draft.ratings ?? []) {
          r[rating.questionId] = rating.score ?? rating.textAnswer ?? "";
        }
        setRatings(r);
      }
    }
    setLoading(false);
  }

  async function save(submit: boolean) {
    if (!employeeId) return;
    setError(""); setSaving(true);

    const ratingList = Object.entries(ratings).map(([qId, val]) => ({
      questionId: Number(qId),
      value: val,
    }));

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, doWell, improve, attention, wouldPick, ratings: ratingList, submit }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Save failed"); setSaving(false); return; }
    if (submit) router.push("/reviews");
    else { setError(""); setSaving(false); }
  }

  // --- AI Comment Suggestion ---
  const ratingCriteria = criteria.filter((c) =>
    c.questions.some((q) => q.answerType === "RATING")
  );

  const ratingsComplete = ratingCriteria.every((c) =>
    c.questions.filter((q) => q.answerType === "RATING").every((q) => ratings[q.id] && Number(ratings[q.id]) >= 1)
  );

  async function suggestComments() {
    if (!employee || !ratingsComplete) return;
    setAiStatus("loading");
    setAiSuggestion(null);
    setAiDecision(null);

    // Compute per-criterion avg from current ratings
    const criteriaRatings = ratingCriteria.map((c) => {
      const qs = c.questions.filter((q) => q.answerType === "RATING");
      const sum = qs.reduce((acc, q) => acc + (Number(ratings[q.id]) || 0), 0);
      return { criterionName: c.name, avgRating: Math.round((sum / qs.length) * 10) / 10 };
    });

    try {
      const res = await fetch("/api/ai/suggest-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: `${employee.firstName} ${employee.lastName}`,
          criteriaRatings,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const suggestion = await res.json();
      setAiSuggestion(suggestion);
      setAiStatus("done");
    } catch {
      setAiStatus("error");
    }
  }

  function acceptSuggestion() {
    if (!aiSuggestion) return;
    setDoWell(aiSuggestion.doWell);
    setImprove(aiSuggestion.improve);
    setAiDecision("accepted");
  }

  function discardSuggestion() {
    setAiSuggestion(null);
    setAiStatus("idle");
    setAiDecision("discarded");
  }

  const allRatingQuestionsAnswered = ratingCriteria.every((c) =>
    c.questions.filter((q) => q.answerType === "RATING").every((q) => ratings[q.id] && Number(ratings[q.id]) >= 1)
  );
  const canSubmit = allRatingQuestionsAnswered && doWell.length >= 20 && improve.length >= 20;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading…</div></div>;
  if (!employee) return <div className="text-center py-12 text-gray-400">Employee not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-lg font-bold">
            {employee.firstName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review: {employee.firstName} {employee.lastName}</h1>
            <p className="text-sm text-gray-500">{employee.jobTitle ?? employee.department.name}</p>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-6">
        {/* eWay Rating criteria */}
        {criteria.filter((c) => c.questions.some((q) => q.answerType === "RATING")).map((criterion) => (
          <div key={criterion.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider mb-1">{criterion.name}</h2>
            {criterion.description && <p className="text-xs text-gray-500 mb-4">{criterion.description}</p>}
            <div className="space-y-4">
              {criterion.questions.filter((q) => q.answerType === "RATING").map((q) => (
                <div key={q.id}>
                  <p className="text-sm text-gray-800 mb-2">{q.sortOrder}. {q.questionText}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} type="button"
                        onClick={() => setRatings((prev) => ({ ...prev, [q.id]: v }))}
                        className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition ${
                          ratings[q.id] === v
                            ? "bg-[#0f1f3d] border-[#0f1f3d] text-white"
                            : "border-gray-200 text-gray-600 hover:border-[#0f1f3d] hover:text-[#0f1f3d]"
                        }`}>
                        {v}
                      </button>
                    ))}
                    <span className="text-xs text-gray-400 self-center ml-2">
                      {ratings[q.id] ? ["","Needs Significant Improvement","Needs Improvement","Meets Expectations","Exceeds Expectations","Exceptional"][Number(ratings[q.id])] : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* AI Comment Suggestions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider">Qualitative Feedback</h2>
            {ratingsComplete && aiStatus !== "done" && (
              <button
                onClick={suggestComments}
                disabled={aiStatus === "loading"}
                className="flex items-center gap-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
              >
                {aiStatus === "loading" ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>✨ AI Suggest Comments</>
                )}
              </button>
            )}
          </div>

          {/* AI error */}
          {aiStatus === "error" && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              AI suggestion failed. Please write your comments manually.
            </div>
          )}

          {/* AI Suggestion Card */}
          {aiStatus === "done" && aiSuggestion && !aiDecision && (
            <div className="mb-5 rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-700 font-bold text-xs uppercase tracking-wider">✨ AI Suggested Comments</span>
                {aiSuggestion.stub && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Demo Mode</span>
                )}
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1">What they do well:</p>
                  <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-purple-100">{aiSuggestion.doWell}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">What to improve:</p>
                  <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-purple-100">{aiSuggestion.improve}</p>
                </div>
              </div>
              <p className="text-xs text-purple-600 mb-3 italic">
                Human-in-the-Loop: Review this AI suggestion and choose to accept, edit, or discard it.
              </p>
              <div className="flex gap-2">
                <button onClick={acceptSuggestion}
                  className="flex-1 rounded-lg bg-purple-600 text-white text-xs font-semibold py-2 hover:bg-purple-700 transition">
                  ✓ Accept
                </button>
                <button onClick={() => { acceptSuggestion(); setAiDecision("edited"); }}
                  className="flex-1 rounded-lg border border-purple-300 text-purple-700 text-xs font-semibold py-2 hover:bg-purple-50 transition">
                  ✏ Accept & Edit
                </button>
                <button onClick={discardSuggestion}
                  className="flex-1 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold py-2 hover:bg-gray-50 transition">
                  ✕ Discard
                </button>
              </div>
            </div>
          )}

          {/* HITL decision badge */}
          {aiDecision && (
            <div className={`mb-4 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 ${
              aiDecision === "discarded"
                ? "bg-gray-100 text-gray-600"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}>
              {aiDecision === "accepted" && "✓ AI suggestion accepted — HITL decision logged"}
              {aiDecision === "edited" && "✏ AI suggestion accepted for editing — HITL decision logged"}
              {aiDecision === "discarded" && "✕ AI suggestion discarded — writing manually"}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What is this person doing well? <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-1">(min 20 chars)</span>
              </label>
              <textarea rows={3} value={doWell} onChange={e => { setDoWell(e.target.value); if (aiDecision === "accepted") setAiDecision("edited"); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20"
                placeholder="Describe what this person does well…" />
              <p className="text-xs text-gray-400 mt-1">{doWell.length} chars</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What should this person pay attention to / improve? <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-1">(min 20 chars)</span>
              </label>
              <textarea rows={3} value={improve} onChange={e => { setImprove(e.target.value); if (aiDecision === "accepted") setAiDecision("edited"); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20"
                placeholder="Describe areas for improvement…" />
              <p className="text-xs text-gray-400 mt-1">{improve.length} chars</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional observations (optional)</label>
              <textarea rows={2} value={attention} onChange={e => setAttention(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20"
                placeholder="Any other comments…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                If you had a challenging project, would you want this person on your team?
              </label>
              <div className="flex gap-3">
                {[true, false].map((val) => (
                  <button key={String(val)} type="button"
                    onClick={() => setWouldPick(val)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                      wouldPick === val ? "bg-[#0f1f3d] border-[#0f1f3d] text-white" : "border-gray-200 text-gray-600 hover:border-[#0f1f3d]"
                    }`}>
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => save(false)} disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60 transition">
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button type="button" onClick={() => save(true)} disabled={saving || !canSubmit}
            className="flex-1 rounded-lg bg-[#0f1f3d] text-white py-2.5 text-sm font-semibold hover:bg-[#1a3160] disabled:opacity-40 transition">
            Submit Review
          </button>
        </div>
        {!canSubmit && (
          <p className="text-xs text-amber-600 -mt-4 pb-6">
            {!allRatingQuestionsAnswered ? "Please rate all questions. " : ""}
            {doWell.length < 20 ? '"What they do well" needs 20+ chars. ' : ""}
            {improve.length < 20 ? '"What to improve" needs 20+ chars.' : ""}
          </p>
        )}
      </div>
    </div>
  );
}
