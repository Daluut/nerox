"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Field } from "@/components/ui/primitives";

const TOPICS = ["General question", "Feedback", "Report a problem", "Partnerships", "Press"];

/**
 * Opens the visitor's own email app with the message filled in. Nothing is sent
 * through Nerox's servers, so no email service is needed.
 */
export function ContactForm({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);

  return (
    <form
      className="mt-5 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const subject = `${topic}${name ? ` from ${name}` : ""}`;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        setOpened(true);
      }}
    >
      <Field label="Your name" htmlFor="c-name">
        <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Field label="What's it about?" htmlFor="c-topic">
        <select id="c-topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Message" htmlFor="c-msg">
        <textarea id="c-msg" className="field min-h-[140px] resize-y" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={3000} />
      </Field>
      <button type="submit" disabled={!message.trim()} className="mk-btn mk-btn-primary self-start disabled:pointer-events-none disabled:opacity-50">
        <Send className="size-4" /> Write the email
      </button>
      <p className="text-[13px] text-muted">
        {opened ? (
          <>
            Your email app should have opened with the message ready to send. If it didn&apos;t, write to{" "}
            <a href={`mailto:${email}`} className="font-medium text-violet hover:underline">
              {email}
            </a>
            .
          </>
        ) : (
          "This opens your email app with your message filled in, ready to send."
        )}
      </p>
    </form>
  );
}
