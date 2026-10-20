"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { adminFetchScores, adminFetchUsers } from "@/app/actions/admin";
import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   AdminTerminal — glassmorphic top-sliding CLI drawer.
   Hotkeys: `~` (or Ctrl+K) toggle the drawer; Esc closes it.
   Slash commands:
     /data users | #data   -> registered user telemetry
     /data scores          -> top scores + verification flags
     /ultron on | /ultron off -> force the global corruption state
     /help | /clear        -> syntax list | wipe the console log
   All data commands run through secure server actions with the
   signed admin session; nothing here mutates the database.
   ================================================================== */

type Tone = "sys" | "cmd" | "ok" | "warn" | "err" | "data";

type Line = { id: number; text: string; tone: Tone };

let lineSeq = 0;

function makeLine(text: string, tone: Tone): Line {
  lineSeq += 1;
  return { id: lineSeq, text, tone };
}

const TONE_CLASS: Record<Tone, string> = {
  sys: "text-[#6b7385]",
  cmd: "text-white",
  ok: "text-[#3dff9a]",
  warn: "text-[#ffb42e]",
  err: "text-[#ff5c7c]",
  data: "text-[#8be9ff]",
};

const HELP_LINES: string[] = [
  "AVAILABLE SYNTAX:",
  "  /data users        stream registered user telemetry (username · xp · created)",
  "  #data              alias for /data users",
  "  /data scores       top high-score telemetry with verification flags",
  "  /ultron on         force the global corruption state",
  "  /ultron off        restore nominal cyan systems",
  "  /help              list valid syntax",
  "  /clear             clear terminal console output",
];

function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g: Record<string, string> = {};
  for (const part of p) g[part.type] = part.value;
  const hour = g.hour === "24" ? "00" : g.hour;
  return `${g.year}-${g.month}-${g.day} ${hour}:${g.minute}:${g.second}`;
}

export function AdminTerminal() {
  const { setOverride } = useUltron();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    makeLine("VORTEX // ULTRON ADMIN TERMINAL v2.0", "sys"),
    makeLine("SECURE CHANNEL READY — TYPE /help FOR COMMAND SYNTAX", "sys"),
  ]);

  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- line streaming helper ---------------- */
  const append = useCallback((text: string, tone: Tone) => {
    setLines((prev) => [...prev, makeLine(text, tone)]);
  }, []);

  const stream = useCallback(
    (rows: string[], tone: Tone) => {
      rows.forEach((text, i) => {
        window.setTimeout(() => append(text, tone), i * 45);
      });
    },
    [append],
  );

  /* ---------------- drawer control ---------------- */
  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const onHotkey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "`" || e.key === "~") {
        if (typing) return; // never hijack live text input
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onHotkey);

    const onOpenEvent = () => setOpen(true);
    window.addEventListener("vortex:open-terminal", onOpenEvent as EventListener);

    return () => {
      window.removeEventListener("keydown", onHotkey);
      window.removeEventListener("vortex:open-terminal", onOpenEvent as EventListener);
    };
  }, [toggle]);

  /* focus the prompt whenever the drawer opens */
  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  /* keep the log pinned to the newest line */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  /* ---------------- command system ---------------- */
  async function runCommand(raw: string): Promise<void> {
    const trimmed = raw.trim();
    if (!trimmed) return;
    append(`❯ ${trimmed}`, "cmd");

    // `#data` style aliases resolve to the slash grammar
    const normalized = trimmed.startsWith("#") ? `/${trimmed.slice(1)}` : trimmed;
    const [head, arg1] = normalized.split(/\s+/);

    switch (head) {
      case "/help":
        stream(HELP_LINES, "sys");
        return;

      case "/clear":
        setLines([]);
        return;

      case "/ultron": {
        const mode = (arg1 ?? "").toLowerCase();
        if (mode !== "on" && mode !== "off") {
          append("USAGE: /ultron on | /ultron off", "warn");
          return;
        }
        setOverride(mode === "on");
        append(
          mode === "on"
            ? "ULTRON TAKEOVER ENGAGED — GLOBAL ACCENT STATE: CORRUPTED CRIMSON"
            : "ULTRON TAKEOVER DISENGAGED — GLOBAL ACCENT STATE: CYBER CYAN",
          mode === "on" ? "err" : "ok",
        );
        return;
      }

      case "/data": {
        const which = (arg1 ?? "users").toLowerCase();
        setBusy(true);
        append(`ESTABLISHING SECURE ADMIN LINK → /data ${which} …`, "sys");
        try {
          if (which === "users") {
            const res = await adminFetchUsers();
            if (!res.ok) {
              append(res.error, "err");
              return;
            }
            stream(
              [
                "USERNAME                 TOTAL XP      CREATED (IST)",
                "-----------------------  ------------  ---------------------",
                ...res.rows.map(
                  (r) =>
                    `${r.username.padEnd(23).slice(0, 23)}  ${String(r.totalXp).padStart(12)}  ${fmtStamp(r.createdAt)}`,
                ),
                `TOTAL RECORDS STREAMED: ${res.rows.length}`,
              ],
              "data",
            );
          } else if (which === "scores") {
            const res = await adminFetchScores();
            if (!res.ok) {
              append(res.error, "err");
              return;
            }
            stream(
              [
                "RANK  PILOT                 GAME                 SCORE       VERIFIED",
                "----  -------------------  ------------------  ----------  --------",
                ...res.rows.map(
                  (r) =>
                    `${String(r.rank).padStart(4)}  ${r.username.padEnd(19).slice(0, 19)}  ${r.game.padEnd(18).slice(0, 18)}  ${String(r.score).padStart(10)}  ${r.verified ? "SIGNED ✓" : "UNVERIFIED"}`,
                ),
                `TOTAL RECORDS STREAMED: ${res.rows.length}`,
              ],
              "data",
            );
          } else {
            append(`UNKNOWN DATA SET: ${which} — TRY /data users OR /data scores`, "warn");
          }
        } finally {
          setBusy(false);
        }
        return;
      }

      default:
        append(`UNKNOWN COMMAND: ${head}`, "err");
        append("TYPE /help FOR VALID SYNTAX", "sys");
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = input;
    setInput("");
    void runCommand(value);
  }

  function onPromptKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <>
      {/* slide-down CLI drawer */}
      <section
        aria-label="Admin command terminal"
        aria-hidden={!open}
        className={`fixed inset-x-0 top-0 z-[120] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "translate-y-0" : "-translate-y-[105%]"
        }`}
      >
        <div className="mx-auto max-w-[110rem] px-3 pt-3">
          <div className="border border-[color:var(--hud-accent-line)] bg-[#05020a]/95 shadow-[0_30px_80px_rgba(0,0,0,0.75)] backdrop-blur-md">
            {/* title bar */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <span className="led-pulse h-2 w-2 rounded-full hud-accent-bg" />
              <p className="font-[JetBrains_Mono,monospace] text-[11px] font-bold tracking-[0.3em] text-white">
                VORTEX // ADMIN COMMAND TERMINAL
              </p>
              <span className="hidden font-[JetBrains_Mono,monospace] text-[9px] tracking-[0.22em] text-[#6b7385] sm:inline">
                SESSION: ROOT-OPS · TRANSPORT: TLS
              </span>
              {busy ? (
                <span className="ml-auto font-[JetBrains_Mono,monospace] text-[9px] tracking-[0.22em] hud-accent">
                  BUSY…
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close terminal"
                className="ml-auto grid h-7 w-7 place-items-center border border-white/10 text-[#8b93a5] transition hover:border-[color:var(--hud-accent-line)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* console log */}
            <div
              ref={logRef}
              className="terminal-scroll h-[42vh] min-h-[220px] overflow-y-auto px-4 py-3 font-[JetBrains_Mono,monospace] text-[11px] leading-[1.75]"
            >
              {lines.map((line) => (
                <div key={line.id} className={`whitespace-pre-wrap break-words ${TONE_CLASS[line.tone]}`}>
                  {line.text}
                </div>
              ))}
            </div>

            {/* prompt */}
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
              <span className="font-[JetBrains_Mono,monospace] text-sm font-bold hud-accent">❯</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onPromptKey}
                spellCheck={false}
                autoComplete="off"
                aria-label="Terminal command input"
                placeholder="/help"
                className="flex-1 bg-transparent font-[JetBrains_Mono,monospace] text-[12px] tracking-[0.08em] text-white outline-none placeholder:text-[#4c5464]"
              />
              <span aria-hidden className="blink h-4 w-2 bg-[color:var(--hud-accent)]" />
              <button
                type="submit"
                disabled={busy}
                className="clip-tag border border-[color:var(--hud-accent-line)] px-4 py-1.5 font-[JetBrains_Mono,monospace] text-[10px] font-bold tracking-[0.22em] hud-accent transition hover:bg-white/5 disabled:opacity-40"
              >
                EXEC
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* scrim while the drawer is open (click closes) */}
      {open ? (
        <button
          type="button"
          aria-label="Close terminal overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[110] cursor-default bg-black/50 backdrop-blur-[2px]"
        />
      ) : null}
    </>
  );
}
