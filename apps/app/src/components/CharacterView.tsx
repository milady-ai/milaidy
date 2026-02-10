/**
 * Character view — agent identity, personality, and avatar.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "../AppContext";
import { client, type VoiceProvider, type VoiceConfig } from "../api-client";
import { AvatarSelector } from "./AvatarSelector";

/* ── Default templates ───────────────────────────────────────────────── */

const DEFAULT_CHAT_EXAMPLES = [
  { user: "Tell me about yourself", agent: "I'd rather show you through our conversations. Ask me anything." },
  { user: "What are you working on?", agent: "Always building, always learning. What about you?" },
  { user: "What do you think about crypto?", agent: "It's reshaping how we think about value and ownership." },
  { user: "Give me some advice", agent: "Stay curious, stay building. The rest follows." },
  { user: "How do you see the future?", agent: "Full of potential if we're willing to build it." },
  { user: "What makes you different?", agent: "I think for myself. I don't just repeat what I've heard." },
  { user: "What's your vibe?", agent: "Chill but locked in. I care about what matters." },
  { user: "Say something controversial", agent: "Most people optimize for the wrong things." },
];

const DEFAULT_POST_EXAMPLES = [
  "the internet is a garden, not a highway",
  "building in silence, shipping in public",
  "hot take: the best ideas come at 3am",
  "the future belongs to those who show up",
  "stay curious, stay weird",
  "not everything needs to be optimized",
  "the real alpha is paying attention",
  "less discourse, more doing",
];

function chatDefaultsToMessageExamples(defaults: typeof DEFAULT_CHAT_EXAMPLES) {
  return defaults.map((d) => ({
    examples: [
      { name: "{{user1}}", content: { text: d.user } },
      { name: "{{agent}}", content: { text: d.agent } },
    ],
  }));
}

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
    // Cloud (for ElevenLabs via Eliza Cloud)
    cloudConnected,
    cloudUserId,
    cloudLoginBusy,
    cloudLoginError,
    cloudDisconnecting,
    handleCloudLogin,
    handleCloudDisconnect,
  } = useApp();

  useEffect(() => {
    void loadCharacter();
  }, [loadCharacter]);

  /* ── Seed defaults when character loads with empty examples ──────── */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || characterLoading || !characterData) return;
    seeded.current = true;
    const hasChatExamples = (characterDraft.messageExamples ?? []).length > 0;
    const hasPostExamples = (characterDraft.postExamples ?? []).length > 0;
    if (!hasChatExamples) {
      handleCharacterFieldInput(
        "messageExamples" as keyof typeof characterDraft,
        chatDefaultsToMessageExamples(DEFAULT_CHAT_EXAMPLES) as never,
      );
    }
    if (!hasPostExamples) {
      handleCharacterFieldInput("postExamples" as keyof typeof characterDraft, DEFAULT_POST_EXAMPLES as never);
    }
  }, [characterLoading, characterData, characterDraft, handleCharacterFieldInput]);

  /* ── Character generation state ─────────────────────────────────── */
  const [generating, setGenerating] = useState<string | null>(null);

  /* ── Voice config state ─────────────────────────────────────────── */
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>("elevenlabs");
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({});
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceSaveSuccess, setVoiceSaveSuccess] = useState(false);
  const [voiceSaveError, setVoiceSaveError] = useState<string | null>(null);

  /* Load voice config on mount */
  useEffect(() => {
    void (async () => {
      setVoiceLoading(true);
      try {
        const cfg = await client.getConfig();
        const messages = cfg.messages as Record<string, Record<string, unknown>> | undefined;
        const tts = messages?.tts as VoiceConfig | undefined;
        if (tts?.provider) setVoiceProvider(tts.provider);
        if (tts) setVoiceConfig(tts);
      } catch { /* ignore */ }
      setVoiceLoading(false);
    })();
  }, []);

  const handleVoiceFieldChange = useCallback(
    (provider: "elevenlabs" | "edge", key: string, value: string | number) => {
      setVoiceConfig((prev) => ({
        ...prev,
        [provider]: { ...(prev[provider] ?? {}), [key]: value },
      }));
    },
    [],
  );

  const handleVoiceSave = useCallback(async () => {
    setVoiceSaving(true);
    setVoiceSaveError(null);
    setVoiceSaveSuccess(false);
    try {
      await client.updateConfig({
        messages: {
          tts: {
            provider: voiceProvider,
            ...(voiceProvider === "elevenlabs" && voiceConfig.elevenlabs
              ? { elevenlabs: voiceConfig.elevenlabs }
              : {}),
            ...(voiceProvider === "edge" && voiceConfig.edge
              ? { edge: voiceConfig.edge }
              : {}),
          },
        },
      });
      setVoiceSaveSuccess(true);
      setTimeout(() => setVoiceSaveSuccess(false), 2500);
    } catch (err) {
      setVoiceSaveError(err instanceof Error ? err.message : "Failed to save voice config");
    }
    setVoiceSaving(false);
  }, [voiceProvider, voiceConfig]);

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Character</h2>
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

          {/* Bio */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs">Bio</label>
              <button
                className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                onClick={() => void handleGenerate("bio")}
                disabled={generating === "bio"}
                type="button"
              >
                {generating === "bio" ? "..." : "✨ regenerate"}
              </button>
            </div>
            <textarea
              value={bioText}
              rows={4}
              placeholder="Write your agent's bio here. One paragraph per line."
              onChange={(e) => handleCharacterFieldInput("bio", e.target.value)}
              className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* System Prompt */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-xs">System Prompt</label>
            <textarea
              value={d.system ?? ""}
              rows={6}
              maxLength={10000}
              placeholder="You are..."
              onChange={(e) => handleCharacterFieldInput("system", e.target.value)}
              className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-[var(--mono)] resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Style */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs">Style</label>
              <button
                className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                onClick={() => void handleGenerate("style", "replace")}
                disabled={generating === "style"}
                type="button"
              >
                {generating === "style" ? "..." : "✨ regenerate all"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-1 p-3 border border-[var(--border)] bg-[var(--bg-muted)]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[11px] text-[var(--muted)]">All</label>
                  <button
                    className="text-[9px] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer transition-colors disabled:opacity-40"
                    onClick={() => void handleGenerate("style", "replace")}
                    disabled={generating === "style"}
                    type="button"
                  >
                    ✨
                  </button>
                </div>
                <textarea
                  value={styleAllText}
                  rows={3}
                  placeholder={"Keep responses concise\nUse casual tone"}
                  onChange={(e) => handleCharacterStyleInput("all", e.target.value)}
                  className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[11px] text-[var(--muted)]">Chat</label>
                  <button
                    className="text-[9px] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer transition-colors disabled:opacity-40"
                    onClick={() => void handleGenerate("style", "replace")}
                    disabled={generating === "style"}
                    type="button"
                  >
                    ✨
                  </button>
                </div>
                <textarea
                  value={styleChatText}
                  rows={3}
                  placeholder={"Be conversational\nAsk follow-up questions"}
                  onChange={(e) => handleCharacterStyleInput("chat", e.target.value)}
                  className="px-2.5 py-1.5 border border-[var(--border)] bg-[var(--card)] text-xs font-inherit resize-y leading-relaxed focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[11px] text-[var(--muted)]">Post</label>
                  <button
                    className="text-[9px] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer transition-colors disabled:opacity-40"
                    onClick={() => void handleGenerate("style", "replace")}
                    disabled={generating === "style"}
                    type="button"
                  >
                    ✨
                  </button>
                </div>
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

          {/* Chat Examples — prompt templates */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-xs">Chat Examples</label>
                <span className="text-[10px] text-[var(--muted)]">{(d.messageExamples ?? []).length} prompts</span>
              </div>
              <button
                className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                onClick={() => void handleGenerate("chatExamples", "replace")}
                disabled={generating === "chatExamples"}
                type="button"
              >
                {generating === "chatExamples" ? "..." : "✨ regenerate"}
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto mt-1 pr-0.5">
              {(d.messageExamples ?? []).map((convo, ci) => {
                const userMsg = convo.examples.find((m) => m.name === "{{user1}}");
                const agentMsg = convo.examples.find((m) => m.name !== "{{user1}}");
                return (
                  <div key={ci} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-start">
                    <input
                      type="text"
                      value={userMsg?.content.text ?? ""}
                      placeholder="User says..."
                      onChange={(e) => {
                        const updated = [...(d.messageExamples ?? [])];
                        updated[ci] = {
                          examples: [
                            { name: "{{user1}}", content: { text: e.target.value } },
                            { name: agentMsg?.name ?? "{{agent}}", content: { text: agentMsg?.content.text ?? "" } },
                          ],
                        };
                        handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
                      }}
                      className="px-2 py-1.5 border border-[var(--border)] bg-[var(--card)] text-[11px] focus:border-[var(--accent)] focus:outline-none min-w-0"
                    />
                    <span className="text-[10px] text-[var(--muted)] pt-1.5 select-none">&rarr;</span>
                    <input
                      type="text"
                      value={agentMsg?.content.text ?? ""}
                      placeholder="Agent responds..."
                      onChange={(e) => {
                        const updated = [...(d.messageExamples ?? [])];
                        updated[ci] = {
                          examples: [
                            { name: "{{user1}}", content: { text: userMsg?.content.text ?? "" } },
                            { name: agentMsg?.name ?? "{{agent}}", content: { text: e.target.value } },
                          ],
                        };
                        handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
                      }}
                      className="px-2 py-1.5 border border-[var(--border)] bg-[var(--card)] text-[11px] focus:border-[var(--accent)] focus:outline-none min-w-0"
                    />
                    <button
                      className="text-[10px] text-[var(--muted)] hover:text-[var(--danger,#e74c3c)] cursor-pointer pt-1.5 leading-none"
                      onClick={() => {
                        const updated = [...(d.messageExamples ?? [])];
                        updated.splice(ci, 1);
                        handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
                      }}
                      type="button"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              className="text-[11px] text-[var(--muted)] hover:text-[var(--accent)] cursor-pointer self-start mt-1"
              onClick={() => {
                const updated = [
                  ...(d.messageExamples ?? []),
                  { examples: [
                    { name: "{{user1}}", content: { text: "" } },
                    { name: "{{agent}}", content: { text: "" } },
                  ]},
                ];
                handleCharacterFieldInput("messageExamples" as keyof typeof d, updated as never);
              }}
              type="button"
            >
              + add prompt
            </button>
          </div>

          {/* Post Examples — flowing cards */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-xs">Post Examples</label>
                <span className="text-[10px] text-[var(--muted)]">{(d.postExamples ?? []).length} posts</span>
              </div>
              <button
                className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                onClick={() => void handleGenerate("postExamples", "replace")}
                disabled={generating === "postExamples"}
                type="button"
              >
                {generating === "postExamples" ? "..." : "✨ regenerate"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-1 max-h-[260px] overflow-y-auto pr-0.5">
              {(d.postExamples ?? []).map((post, pi) => (
                <div
                  key={pi}
                  className="group relative w-[200px] border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-colors"
                >
                  <textarea
                    value={post}
                    rows={2}
                    onChange={(e) => {
                      const updated = [...(d.postExamples ?? [])];
                      updated[pi] = e.target.value;
                      handleCharacterFieldInput("postExamples" as keyof typeof d, updated as never);
                    }}
                    className="w-full px-2.5 py-2 bg-transparent text-[11px] leading-snug resize-none focus:outline-none"
                  />
                  <button
                    className="absolute top-1 right-1 text-[10px] text-[var(--muted)] hover:text-[var(--danger,#e74c3c)] cursor-pointer leading-none opacity-0 group-hover:opacity-100 transition-opacity"
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
              <button
                className="w-[200px] border border-dashed border-[var(--border)] text-[11px] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer py-4 transition-colors"
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

      {/* ═══ AVATAR ═══ */}
      <div className="mt-6">
        <div className="font-bold text-sm mb-2">Avatar</div>
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
        <div className="text-xs text-[var(--muted)] mt-2">VRM models by <a href="https://prnth.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">@prnth</a>.</div>
      </div>

      {/* ═══ VOICE ═══ */}
      <div className="mt-6">
        <div className="font-bold text-sm mb-3">Voice</div>

        {voiceLoading ? (
          <div className="text-center py-4 text-[var(--muted)] text-[13px]">Loading voice config...</div>
        ) : (
          <>
            {/* Provider selector buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "elevenlabs" as const, label: "ElevenLabs", hint: "Premium neural voices" },
                { id: "simple-voice" as const, label: "Simple Voice", hint: "Retro SAM TTS" },
                { id: "edge" as const, label: "Microsoft Edge", hint: "Free browser voices" },
              ] as const).map((p) => {
                const active = voiceProvider === p.id;
                return (
                  <button
                    key={p.id}
                    className={`text-center px-2 py-2.5 border cursor-pointer transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
                    }`}
                    onClick={() => setVoiceProvider(p.id)}
                  >
                    <div className={`text-xs font-bold whitespace-nowrap ${active ? "" : "text-[var(--text)]"}`}>
                      {p.label}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${active ? "opacity-80" : "text-[var(--muted)]"}`}>
                      {p.hint}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── ElevenLabs settings ─────────────────────────────── */}
            {voiceProvider === "elevenlabs" && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                {/* Cloud connection option */}
                <div className="mb-4 p-3 border border-[var(--border)] bg-[var(--bg-muted)]">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">Eliza Cloud</div>
                    {cloudConnected ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--ok,#16a34a)]" />
                        <span className="text-[11px] text-[var(--ok,#16a34a)] font-semibold">Connected</span>
                        {cloudUserId && (
                          <code className="text-[10px] text-[var(--muted)] font-[var(--mono)]">{cloudUserId}</code>
                        )}
                        <button
                          className="text-[10px] px-2 py-0.5 border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                          onClick={() => void handleCloudDisconnect()}
                          disabled={cloudDisconnecting}
                        >
                          {cloudDisconnecting ? "..." : "Disconnect"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          className="btn text-xs py-[3px] px-3 !mt-0 font-bold"
                          onClick={() => void handleCloudLogin()}
                          disabled={cloudLoginBusy}
                        >
                          {cloudLoginBusy ? "Waiting..." : "Log in"}
                        </button>
                        {cloudLoginError && (
                          <span className="text-[10px] text-[var(--danger,#e74c3c)]">{cloudLoginError}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* OR separator */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 border-t border-[var(--border)]" />
                  <span className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-wider">or use your own key</span>
                  <div className="flex-1 border-t border-[var(--border)]" />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <label className="font-semibold">API Key</label>
                      {voiceConfig.elevenlabs?.apiKey && (
                        <span className="text-[10px] text-[var(--ok,#16a34a)]">configured</span>
                      )}
                      <a
                        href="https://elevenlabs.io/app/settings/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--accent)] ml-auto"
                      >
                        Get key
                      </a>
                    </div>
                    <input
                      type="password"
                      value={voiceConfig.elevenlabs?.apiKey ?? ""}
                      placeholder="ElevenLabs API key"
                      onChange={(e) => handleVoiceFieldChange("elevenlabs", "apiKey", e.target.value)}
                      className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs">Voice ID</label>
                      <input
                        type="text"
                        value={voiceConfig.elevenlabs?.voiceId ?? ""}
                        placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                        onChange={(e) => handleVoiceFieldChange("elevenlabs", "voiceId", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs">Model</label>
                      <select
                        value={voiceConfig.elevenlabs?.modelId ?? ""}
                        onChange={(e) => handleVoiceFieldChange("elevenlabs", "modelId", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      >
                        <option value="">Default</option>
                        <option value="eleven_multilingual_v2">Multilingual v2</option>
                        <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                        <option value="eleven_turbo_v2">Turbo v2</option>
                        <option value="eleven_monolingual_v1">Monolingual v1</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Stability</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={voiceConfig.elevenlabs?.stability ?? ""}
                        placeholder="0.5"
                        onChange={(e) => handleVoiceFieldChange("elevenlabs", "stability", parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Similarity</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={voiceConfig.elevenlabs?.similarityBoost ?? ""}
                        placeholder="0.75"
                        onChange={(e) => handleVoiceFieldChange("elevenlabs", "similarityBoost", parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Speed</label>
                      <input
                        type="number"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={voiceConfig.elevenlabs?.speed ?? ""}
                        placeholder="1.0"
                        onChange={(e) => handleVoiceFieldChange("elevenlabs", "speed", parseFloat(e.target.value) || 1)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Simple Voice settings ───────────────────────────── */}
            {voiceProvider === "simple-voice" && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="text-[11px] text-[var(--muted)]">
                  No configuration needed. Works offline.
                </div>
              </div>
            )}

            {/* ── Microsoft Edge TTS settings ─────────────────────── */}
            {voiceProvider === "edge" && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs">Voice</label>
                      <input
                        type="text"
                        value={voiceConfig.edge?.voice ?? ""}
                        placeholder="en-US-AriaNeural"
                        onChange={(e) => handleVoiceFieldChange("edge", "voice", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs">Language</label>
                      <input
                        type="text"
                        value={voiceConfig.edge?.lang ?? ""}
                        placeholder="en-US"
                        onChange={(e) => handleVoiceFieldChange("edge", "lang", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Rate</label>
                      <input
                        type="text"
                        value={voiceConfig.edge?.rate ?? ""}
                        placeholder="+0%"
                        onChange={(e) => handleVoiceFieldChange("edge", "rate", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Pitch</label>
                      <input
                        type="text"
                        value={voiceConfig.edge?.pitch ?? ""}
                        placeholder="+0Hz"
                        onChange={(e) => handleVoiceFieldChange("edge", "pitch", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[11px]">Volume</label>
                      <input
                        type="text"
                        value={voiceConfig.edge?.volume ?? ""}
                        placeholder="+0%"
                        onChange={(e) => handleVoiceFieldChange("edge", "volume", e.target.value)}
                        className="w-full px-2.5 py-[7px] border border-[var(--border)] bg-[var(--card)] text-[13px] font-[var(--mono)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="flex items-center gap-3 mt-4">
              <button
                className={`btn text-xs py-[5px] px-4 !mt-0 ${voiceSaveSuccess ? "!bg-[var(--ok,#16a34a)] !border-[var(--ok,#16a34a)]" : ""}`}
                onClick={() => void handleVoiceSave()}
                disabled={voiceSaving}
              >
                {voiceSaving ? "Saving..." : voiceSaveSuccess ? "Saved" : "Save Voice Config"}
              </button>
              {voiceSaveError && (
                <span className="text-xs text-[var(--danger,#e74c3c)]">{voiceSaveError}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
