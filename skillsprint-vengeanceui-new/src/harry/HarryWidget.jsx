import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../services/authService";
import { getHarryReply, createInitialContext } from "../services/harryService";
import { useHarrySpeech } from "./useHarrySpeech";
import {
  init as initMovement,
  subscribe as subscribeMovement,
  getSnapshot as getMovementSnapshot,
  setBusy as setMovementBusy,
  HARRY_WALK_DURATION
} from "./harryMovementController";
import harryFull from "./assets/harry-full.png";
import harryFace from "./assets/harry-face.png";

// HarryWidget.jsx
//
// This file owns presentation only. All conversational/opportunity
// reasoning lives in services/harryService.js; all walking-schedule logic
// lives in harryMovementController.js; all Web Speech API details live in
// useHarrySpeech.js. That keeps this component focused on: character
// states, layout, and wiring user input to the two services above.

const SUGGESTIONS = [
  "What gigs suit me?",
  "Find something I can finish today",
  "What skills should I learn?",
  "Analyze my skill gap",
  "Help me prepare for a role"
];

const VOICE_ERROR_MESSAGES = {
  "not-allowed": "I couldn't access your microphone — please allow microphone access and try again.",
  "audio-capture": "I couldn't find a microphone on this device.",
  "no-speech": "I didn't catch any speech — try again whenever you're ready.",
  network: "Voice recognition hit a network issue — please try again.",
  unsupported: "Voice input isn't supported in this browser — you can still type to me.",
  empty: "I didn't catch any speech — try again whenever you're ready.",
  "start-failed": "I couldn't start listening just then — please try again."
};

function OpportunityMiniCard({ task, navigate }) {
  return (
    <div className="harry-opp-card">
      <div className="harry-opp-top">
        <b>{task.title}</b>
        <span className="harry-opp-score">{task.matchScore}% match</span>
      </div>
      <p className="harry-opp-org">{task.organization}</p>
      <div className="harry-opp-tags">
        {task.requiredSkills.slice(0, 4).map(s => <span key={s} className="tag">{s}</span>)}
      </div>
      <p className="harry-opp-meta">{task.workMode} · {task.duration} · {task.reward}</p>
      {task.explanation && <p className="harry-opp-explain">{task.explanation}</p>}
      {task.alreadyApplied && <p className="hint">You've already applied — status: {task.applicationStatus}</p>}
      <div className="button-row">
        <button className="btn secondary" onClick={() => navigate(`/opportunities/${task.id}`)}>View Opportunity</button>
        {!task.alreadyApplied && <button className="btn primary" onClick={() => navigate(`/opportunities/${task.id}/apply`)}>Apply</button>}
      </div>
    </div>
  );
}

export default function HarryWidget() {
  const [user, setUser] = useState(getCurrentUser());
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onUserChanged(e) { setUser(e.detail); }
    window.addEventListener("skillsprint:user-changed", onUserChanged);
    return () => window.removeEventListener("skillsprint:user-changed", onUserChanged);
  }, []);

  const [messages, setMessages] = useState([
    { role: "harry", text: "Hi, I'm Harry — your SkillSprint assistant, powered by a real AI model. Ask me to find live opportunities, explain a match, break down your skill gaps, or ask me anything about careers and skills — I'm not limited to your profile.", tasks: [] }
  ]);
  const [context, setContext] = useState(createInitialContext);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  // --- Character state machine (idle / listening / thinking / talking) ---
  // "walking" is reported separately by the movement controller and only
  // applies while the chat panel is closed (see render below).
  const [convState, setConvState] = useState("idle"); // idle | listening | thinking | talking
  const [voiceNotice, setVoiceNotice] = useState("");

  // --- Hourly walking schedule (single app-wide timer; see controller) ---
  const [movement, setMovement] = useState(getMovementSnapshot);
  useEffect(() => {
    initMovement();
    return subscribeMovement(setMovement);
  }, []);

  // Tell the movement controller whenever we're mid-interaction so the
  // hourly walk politely waits its turn instead of interrupting.
  useEffect(() => {
    setMovementBusy(convState !== "idle");
  }, [convState]);

  function handleAction(action) {
    if (!action) return;
    if (action.type === "navigate_apply") navigate(`/opportunities/${action.taskId}/apply`);
  }

  function respondTo(trimmed) {
    setMessages(m => [...m, { role: "user", text: trimmed, tasks: [] }]);
    setInput("");
    setTyping(true);
    setConvState("thinking");
    setTimeout(async () => {
      const freshUser = getCurrentUser();
      const { message, context: nextContext } = await getHarryReply(trimmed, freshUser, context);
      setContext(nextContext);
      setMessages(m => [...m, message]);
      setTyping(false);
      handleAction(message.action);
      if (voiceOutputEnabled) {
        speak(message.text);
      } else {
        setConvState("idle");
      }
    }, 380);
  }

  const {
    recognitionSupported,
    speechSupported,
    listening,
    startListening,
    stopListening,
    speak,
    voiceOutputEnabled,
    setVoiceOutputEnabled
  } = useHarrySpeech({
    onResult: (transcript) => {
      setVoiceNotice("");
      respondTo(transcript);
    },
    onError: (code) => {
      setConvState("idle");
      setVoiceNotice(VOICE_ERROR_MESSAGES[code] || "Something went wrong with voice input — please try typing instead.");
    },
    onSpeechStart: () => setConvState("talking"),
    onSpeechEnd: () => setConvState("idle")
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    if (listening) setConvState("listening");
  }, [listening]);

  if (!user || user.role !== "student") return null;

  function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;
    respondTo(trimmed);
  }

  function toggleMic() {
    setVoiceNotice("");
    if (listening) {
      stopListening();
      setConvState("idle");
    } else {
      startListening();
    }
  }

  const displayState = open ? convState : movement.state; // "walking" only shown while closed

  return (
    <>
      {open && (
        <div className="harry-panel-wrap">
          <div className="harry-panel card">
            <div className={`harry-header harry-state-${convState}`}>
              <div className="harry-avatar-wrap">
                <div className="harry-avatar-ring" />
                <img src={harryFace} alt="Harry" />
              </div>
              <div>
                <b>Harry</b>
                <div className="harry-status-line">
                  {convState === "listening" && "Listening…"}
                  {convState === "thinking" && "Thinking…"}
                  {convState === "talking" && "Speaking…"}
                  {convState === "idle" && "Assistant · ready"}
                </div>
              </div>
              <div className="harry-header-actions">
                <button
                  type="button"
                  className={`harry-icon-btn ${voiceOutputEnabled ? "active" : ""}`}
                  title={voiceOutputEnabled ? "Turn off Harry's voice" : "Turn on Harry's voice"}
                  aria-pressed={voiceOutputEnabled}
                  onClick={() => setVoiceOutputEnabled(v => !v)}
                  disabled={!speechSupported}
                >
                  {voiceOutputEnabled ? "🔊" : "🔇"}
                </button>
                <button className="harry-close" aria-label="Close Harry" onClick={() => setOpen(false)}>×</button>
              </div>
            </div>
            <div className="harry-messages" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`harry-msg ${m.role === "user" ? "mine" : ""}`}>
                  <div className={`chat-bubble ${m.role === "user" ? "mine" : "theirs"}`}>{m.text}</div>
                  {m.tasks?.length > 0 && (
                    <div className="harry-opp-list">
                      {m.tasks.map(t => <OpportunityMiniCard key={t.id} task={t} navigate={(path) => { setOpen(true); navigate(path); }} />)}
                    </div>
                  )}
                </div>
              ))}
              {typing && <div className="harry-msg"><div className="chat-bubble harry-typing"><span/><span/><span/></div></div>}
            </div>
            {messages.length <= 1 && (
              <div className="harry-suggestions">
                {SUGGESTIONS.map(s => <button key={s} className="harry-chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {voiceNotice && <div className="harry-voice-note">{voiceNotice}</div>}
            <form className="harry-input-row" onSubmit={e => { e.preventDefault(); send(); }}>
              <button
                type="button"
                className={`harry-mic-btn ${listening ? "listening" : ""}`}
                onClick={toggleMic}
                disabled={!recognitionSupported}
                title={recognitionSupported ? (listening ? "Stop listening" : "Talk to Harry") : "Voice input isn't supported in this browser"}
                aria-label={listening ? "Stop listening" : "Talk to Harry"}
              >
                {listening ? "■" : "🎙️"}
              </button>
              <input placeholder="Ask Harry anything…" value={input} onChange={e => setInput(e.target.value)} />
              <button className="btn primary" type="submit">Send</button>
            </form>
          </div>
        </div>
      )}

      {!open && (
        <button
          className={`harry-floating harry-state-${displayState}`}
          style={{
            top: movement.position.top,
            left: movement.position.left,
            transitionDuration: `${HARRY_WALK_DURATION}ms`
          }}
          onClick={() => setOpen(true)}
          aria-label="Open Harry, your SkillSprint assistant"
          title="Chat with Harry"
        >
          <img src={harryFull} alt="Harry, your SkillSprint assistant" />
          <span className="harry-badge" />
        </button>
      )}
    </>
  );
}
