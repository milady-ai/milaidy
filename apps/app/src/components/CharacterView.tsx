/**
 * Character view — agent identity, personality, and avatar.
 */

import { useEffect, useState, useCallback } from "react";
import { useApp } from "../AppContext";
import { client } from "../api-client";
import { AvatarSelector } from "./AvatarSelector";

export function CharacterView() {
  const {
    characterData,
    characterDraft,
    characterLoading,
    characterSaving,
    characterSaveSuccess,
    characterSaveError,
    handleCharacterFieldInput,
    handleCharacterArrayInput,
    handleCharacterStyleInput,
    handleSaveCharacter,
    loadCharacter,
    setState,
    selectedVrmIndex,
  } = useApp();

  useEffect(() => {
    void loadCharacter();
  }, [loadCharacter]);

  /* ── Character generation state ─────────────────────────────────── */
  const [generating, setGenerating] = useState<string | null>(null);

  const d = characterDraft;
  const bioText = typeof d.bio === "string" ? d.bio : Array.isArray(d.bio) ? d.bio.join("\n") : "";
  const styleAllText = (d.style?.all ?? []).join("\n");
  const styleChatText = (d.style?.chat ?? []).join("\n");
  const stylePostText = (d.style?.post ?? []).join("\n");

  const getCharContext = useCallback(() => ({
    name: d.name ?? "",
    system: d.system ?? "",
    bio: bioText,
    style: d.style ?? { all: [], chat: [], post: [] },
    postExamples: d.postExamples ?? [],
  }), [d, bioText]);

  const handleGenerate = useCallback(async (field: string, mode: "append" | "replace" = "replace") => {
    setGenerating(field);
    try {
      const { generated } = await client.generateCharacterField(field, getCharContext(), mode);
      if (field === "bio") {
        handleCharacterFieldInput("bio", generated.trim());
      } else if (field === "style") {
        try {
          const parsed = JSON.parse(generated);
          if (mode === "append") {
            handleCharacterStyleInput("all", [...(d.style?.all ?? []), ...(parsed.all ?? [])].join("\n"));
            handleCharacterStyleInput("chat", [...(d.style?.chat ?? []), ...(parsed.chat ?? [])].join("\n"));
            handleCharacterStyleInput("post", [...(d.style?.post ?? []), ...(parsed.post ?? [])].join("\n"));
          } else {
            if (parsed.all) handleCharacterStyleInput("all", parsed.all.join("\n"));
            if (parsed.chat) handleCharacterStyleInput("chat", parsed.chat.join("\n"));
            if (parsed.post) handleCharacterStyleInput("post", parsed.post.join("\n"));
          }
        } catch { /* raw text fallback */ }
      } else if (field === "chatExamples") {
        try {
          const parsed = JSON.parse(generated);
          if (Array.isArray(parsed)) {
            const formatted = parsed.map((convo: Array<{ user: string; content: { text: string } }>) => ({
              examples: convo.map((msg) => ({ name: msg.user, content: { text: msg.content.text } })),
            }));
            handleCharacterFieldInput("messageExamples" as keyof typeof d, formatted as never);
          }
        } catch { /* raw text fallback */ }
      } else if (field === "postExamples") {
        try {
          const parsed = JSON.parse(generated);
          if (Array.isArray(parsed)) {
            if (mode === "append") {
              handleCharacterArrayInput("postExamples", [...(d.postExamples ?? []), ...parsed].join("\n"));
            } else {
              handleCharacterArrayInput("postExamples", parsed.join("\n"));
            }
          }
        } catch { /* raw text fallback */ }
      }
    } catch {
      /* generation failed — silently ignore */
    }
    setGenerating(null);
  }, [getCharContext, d, handleCharacterFieldInput, handleCharacterArrayInput, handleCharacterStyleInput]);

  const handleRandomName = useCallback(async () => {
    try {
      const { name } = await client.getRandomName();
      handleCharacterFieldInput("name", name);
    } catch { /* ignore */ }
  }, [handleCharacterFieldInput]);

  return (
    <div>
      <h2 className="text-lg font-bold">Character</h2>
      {/* Note: "Soul" = system prompt, "Identity" = bio in Eliza terms */}
      <p className="text-[13px] text-[var(--muted)] mb-5">Soul, identity, and appearance.</p>

      {/* ═══ CHARACTER IDENTITY ═══ */}
      <div className="mt-6 p-4 border border-[var(--border)] bg-[var(--card)]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-bold text-sm">Soul &amp; Identity</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Define your agent&apos;s name, soul, identity, and communication style.
            </div>
          </div>
          <button
            className="btn whitespace-nowrap !mt-0 text-xs py-1.5 px-3.5"
            onClick={() => void loadCharacter()}
            disabled={characterLoading}
          >
            {characterLoading ? "Loading..." : "Reload"}
          </button>
        </div>

        {characterLoading && !characterData ? (
          <div className="text-center py-6 text-[var(--muted)] text-[13px]">
            Loading character data...
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-xs">Name</label>
              <div className="text-[11px] text-[var(--muted)]">Agent display name (max 50 characters)</div>
              <div className="flex items-center gap-2 max-w-[280px]">
                <input
                  type="text"
                  value={d.name ?? ""}
                  maxLength={50}
                  placeholder="Agent name"
                  onChange={(e) => handleCharacterFieldInput("name", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-[13px] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  className="px-2 py-1.5 border border-[var(--border)] bg-[var(--card)] text-[13px] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  onClick={() => void handleRandomName()}
                  title="Random name"
                  type="button"
                >
                  &#x21bb;
                </button>
              </div>
            </div>

            {/* Identity (bio) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-xs">Identity</label>
                <button
                  className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                  onClick={() => void handleGenerate("bio")}
                  disabled={generating === "bio"}
                  title="Generate identity using AI"
                  type="button"
                >
                  {generating === "bio" ? "generating..." : "generate"}
                </button>
              </div>
              <div className="text-[11px] text-[var(--muted)]">Who your agent is — personality, background, vibes. One paragraph per line.</div>
              <textarea
                value={bioText}
                rows={4}
                placeholder="Describe who your agent is. Their personality, background, how they see the world."
                onChange={(e) => handleCharacterFieldInput("bio", e.target.value)}
                className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            {/* Soul (system prompt) */}
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-xs">Soul</label>
              <div className="text-[11px] text-[var(--muted)]">How your agent thinks and behaves — their core essence (max 10,000 characters)</div>
              <textarea
                value={d.system ?? ""}
                rows={6}
                maxLength={10000}
                placeholder="You are..."
                onChange={(e) => handleCharacterFieldInput("system", e.target.value)}
                className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-[var(--mono)] resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            {/* Advanced */}
            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold list-none [&::-webkit-details-marker]:hidden">
                <span className="inline-block transition-transform group-open:rotate-90">&#9654;</span>
                Advanced
                <span className="font-normal text-[var(--muted)]">— style, chat examples, post examples</span>
              </summary>

              <div className="flex flex-col gap-4 mt-3 pl-0.5">
                {/* Style */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-xs">Style</label>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("style", "append")}
                      disabled={generating === "style"}
                      title="Add more style rules"
                      type="button"
                    >
                      {generating === "style" ? "generating..." : "+ generate"}
                    </button>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("style", "replace")}
                      disabled={generating === "style"}
                      title="Regenerate all style rules"
                      type="button"
                    >
                      &#x21bb; recycle
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">Communication style guidelines — one rule per line</div>

                  <div className="grid grid-cols-3 gap-3 mt-1 p-3 border border-[var(--border)] bg-[var(--bg-muted)]">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px] text-[var(--muted)]">All</label>
                      <textarea
                        value={styleAllText}
                        rows={3}
                        placeholder={"Keep responses concise\nUse casual tone"}
                        onChange={(e) => handleCharacterStyleInput("all", e.target.value)}
                        className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px] text-[var(--muted)]">Chat</label>
                      <textarea
                        value={styleChatText}
                        rows={3}
                        placeholder={"Be conversational\nAsk follow-up questions"}
                        onChange={(e) => handleCharacterStyleInput("chat", e.target.value)}
                        className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px] text-[var(--muted)]">Post</label>
                      <textarea
                        value={stylePostText}
                        rows={3}
                        placeholder={"Use hashtags sparingly\nKeep under 280 characters"}
                        onChange={(e) => handleCharacterStyleInput("post", e.target.value)}
                        className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Chat Examples */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-xs">Chat Examples</label>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("chatExamples", "replace")}
                      disabled={generating === "chatExamples"}
                      title="Generate new chat examples"
                      type="button"
                    >
                      {generating === "chatExamples" ? "generating..." : "generate"}
                    </button>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("chatExamples", "replace")}
                      disabled={generating === "chatExamples"}
                      title="Regenerate all chat examples"
                      type="button"
                    >
                      &#x21bb; recycle
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">Example conversations showing how the agent responds</div>

                  <div className="flex flex-col gap-2 mt-1">
                    {(d.messageExamples ?? []).map((convo, ci) => (
                      <div key={ci} className="p-2.5 border border-[var(--border)] bg-[var(--bg-muted)]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-[var(--muted)] font-semibold">Conversation {ci + 1}</span>
                          <button
                            className="text-[10px] text-[var(--muted)] hover:text-[var(--danger,#e74c3c)] cursor-pointer"
                            onClick={() => {
                              const updated = [...(d.messageExamples ?? [])];
                              updated.splice(ci, 1);
                              handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
                            }}
                            type="button"
                          >
                            remove
                          </button>
                        </div>
                        {convo.examples.map((msg, mi) => (
                          <div key={mi} className="flex gap-2 mb-1 last:mb-0">
                            <span className={`text-[10px] font-semibold shrink-0 w-16 pt-0.5 ${msg.name === "{{user1}}" ? "text-[var(--muted)]" : "text-[var(--accent)]"}`}>
                              {msg.name === "{{user1}}" ? "User" : "Agent"}
                            </span>
                            <input
                              type="text"
                              value={msg.content.text}
                              onChange={(e) => {
                                const updated = [...(d.messageExamples ?? [])];
                                const convoClone = { examples: [...updated[ci].examples] };
                                convoClone.examples[mi] = { ...convoClone.examples[mi], content: { text: e.target.value } };
                                updated[ci] = convoClone;
                                handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
                              }}
                              className="flex-1 px-2 py-1 border border-[var(--border)] bg-[var(--card)] text-xs focus:border-[var(--accent)] focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                    {(d.messageExamples ?? []).length === 0 && (
                      <div className="text-[11px] text-[var(--muted)] py-2">No chat examples yet. Click generate to create some.</div>
                    )}
                  </div>
                </div>

                {/* Post Examples */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-xs">Post Examples</label>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("postExamples", "append")}
                      disabled={generating === "postExamples"}
                      title="Generate more posts"
                      type="button"
                    >
                      {generating === "postExamples" ? "generating..." : "+ generate"}
                    </button>
                    <button
                      className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      onClick={() => void handleGenerate("postExamples", "replace")}
                      disabled={generating === "postExamples"}
                      title="Regenerate all posts"
                      type="button"
                    >
                      &#x21bb; recycle
                    </button>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">Example social media posts this agent would write</div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    {(d.postExamples ?? []).map((post, pi) => (
                      <div key={pi} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={post}
                          onChange={(e) => {
                            const updated = [...(d.postExamples ?? [])];
                            updated[pi] = e.target.value;
                            handleCharacterFieldInput("postExamples" as keyof typeof d, updated as never);
                          }}
                          className="flex-1 px-2 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs focus:border-[var(--accent)] focus:outline-none"
                        />
                        <button
                          className="text-[10px] text-[var(--muted)] hover:text-[var(--danger,#e74c3c)] cursor-pointer shrink-0 py-1.5"
                          onClick={() => {
                            const updated = [...(d.postExamples ?? [])];
                            updated.splice(pi, 1);
                            handleCharacterFieldInput("postExamples" as keyof typeof d, updated as never);
                          }}
                          type="button"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {(d.postExamples ?? []).length === 0 && (
                      <div className="text-[11px] text-[var(--muted)] py-2">No post examples yet. Click generate to create some.</div>
                    )}
                    <button
                      className="text-[11px] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer self-start mt-0.5"
                      onClick={() => {
                        const updated = [...(d.postExamples ?? []), ""];
                        handleCharacterFieldInput("postExamples" as keyof typeof d, updated as never);
                      }}
                      type="button"
                    >
                      + add post
                    </button>
                  </div>
                </div>
              </div>
            </details>

            {/* Save Button */}
            <div className="flex items-center gap-3 mt-1">
              <button
                className="btn text-[13px] py-2 px-6 !mt-0"
                disabled={characterSaving}
                onClick={() => void handleSaveCharacter()}
              >
                {characterSaving ? "Saving..." : "Save Character"}
              </button>
              {characterSaveSuccess && (
                <span className="text-xs text-[var(--ok,#16a34a)]">{characterSaveSuccess}</span>
              )}
              {characterSaveError && (
                <span className="text-xs text-[var(--danger,#e74c3c)]">{characterSaveError}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ AVATAR ═══ */}
      <div className="mt-6 p-4 border border-[var(--border)] bg-[var(--card)]">
        <div className="font-bold text-sm mb-1">Avatar</div>
        <AvatarSelector
          selected={selectedVrmIndex}
          onSelect={(i) => setState("selectedVrmIndex", i)}
          onUpload={(file) => {
            const url = URL.createObjectURL(file);
            setState("customVrmUrl", url);
            setState("selectedVrmIndex", 0);
          }}
          showUpload
        />
        <div className="text-xs text-[var(--muted)] m-3">VRM models by <a href="https://prnth.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">@prnth</a>.</div>
      </div>
    </div>
  );
}
