import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createAgentNativeAgentKitTransport } from "@agent-native/core/client/agentkit-chat/transport";
import { AgentNativeI18nProvider } from "@agent-native/core/client/i18n";
import {
  GuidedQuestionFlow,
  useGuidedQuestionFlow,
} from "@agent-native/toolkit/app/chat/agentkit-chat/questions";
import { CoreAgentKitRoot } from "@agent-native/toolkit/app/chat/agentkit-chat/index";
import {
  useAgentKitControl,
  useAgentThread,
} from "@agent-native/toolkit/app/agentkit/react/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAgentRouteState } from "@agent-native/core/client/navigation";
import { TAB_ID } from "../lib/tab-id";
import { useLanguage } from "../lib/language";

export function MonthHelper() {
  const lang = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <section className="card month-helper">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {lang === "es" ? "Preguntar sobre mi mes" : "Ask about my month"}
      </button>
      {open && <HelperChat />}
    </section>
  );
}
function HelperChat() {
  const lang = useLanguage();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );
  const [threadId] = useState(() => crypto.randomUUID());
  const [transport] = useState(() =>
    createAgentNativeAgentKitTransport({
      apiUrl: "/_agent-native/month-helper",
      browserTabId: TAB_ID,
      surface: "app",
      headers: { "accept-language": lang === "es" ? "es-US" : "en-US" },
    }),
  );
  return (
    <AgentNativeI18nProvider
      initialLocale={lang === "es" ? "es-US" : "en-US"}
      persistPreference={false}
    >
      <QueryClientProvider client={queryClient}>
        <CoreAgentKitRoot threadId={threadId} transport={transport}>
          <Conversation />
        </CoreAgentKitRoot>
      </QueryClientProvider>
    </AgentNativeI18nProvider>
  );
}
function Conversation() {
  const lang = useLanguage(),
    es = lang === "es";
  useAgentRouteState<{ path: string; language?: string }>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname, search }) => ({
      path: pathname + search,
      language: es ? "es-US" : "en-US",
    }),
    getCommandPath: (command) =>
      /^\/(example|add|review|check|months)(?:[/?]|$)/.test(command.path)
        ? command.path
        : null,
    writeGlobalNavigation: false,
    readGlobalCommandFallback: false,
  });
  const control = useAgentKitControl();
  const thread = useAgentThread();
  const questions = useGuidedQuestionFlow({
    stateKey: "guided-questions",
    browserTabId: TAB_ID,
    threadId: thread.id,
    refetchInterval: 1000,
    buildSubmitContext: () => "",
    onSubmitMessage: async ({ formattedAnswers }) => {
      await control.sendMessage({
        text: formattedAnswers,
        queueWhileRunning: false,
      });
      return { delivered: true };
    },
    onSkipMessage: async ({ message }) => {
      await control.sendMessage({ text: message, queueWhileRunning: false });
      return { delivered: true };
    },
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runError = Object.values(thread.runs)
    .reverse()
    .find((run) => run.error)?.error;
  const unavailable = es
    ? "La ayuda no está disponible ahora. Puedes mirar y escribir líneas por tu cuenta."
    : "The helper is not available right now. You can still look around and type lines yourself.";
  return (
    <>
      <p>
        {es
          ? "Pregunta sobre tus pruebas y respuestas guardadas. Tú revisas cada línea propuesta."
          : "Ask about your saved proof and answers. You review each proposed line."}
      </p>
      <div aria-live="polite" role="log">
        {thread.messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
          return message.role === "user" ? (
            <p key={message.id} className="helper-question">
              {text}
            </p>
          ) : (
            <div key={message.id} className="helper-answer">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
      {questions.questions && (
        <GuidedQuestionFlow
          questions={questions.questions}
          {...(questions.title ? { title: questions.title } : {})}
          {...(questions.description
            ? { description: questions.description }
            : {})}
          submitLabel={es ? "Enviar respuestas" : "Send answers"}
          skipLabel={es ? "Omitir" : "Skip"}
          onSubmit={questions.handleSubmit}
          onSkip={questions.handleSkip}
          isSubmissionBlocked={questions.isSubmissionBlocked}
          providerStatus={questions.providerStatus}
          onRetryProviderStatus={questions.retryProviderStatus}
        />
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!text.trim() || busy) return;
          setBusy(true);
          setError("");
          try {
            await control.sendMessage({
              queueWhileRunning: false,
              text,
            });
            setText("");
          } catch (failure) {
            const message = failure instanceof Error ? failure.message : "";
            setError(
              message.includes("resting") || message.includes("descansa")
                ? message
                : es
                  ? "La ayuda no está disponible ahora. Puedes mirar y escribir líneas por tu cuenta."
                  : "The helper is not available right now. You can still look around and type lines yourself.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="month-question">
          {es ? "Tu pregunta" : "Your question"}
        </label>
        <textarea
          id="month-question"
          maxLength={4000}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button disabled={busy || thread.activeRunIds.length > 0}>
          {busy ? (es ? "Enviando…" : "Sending…") : es ? "Preguntar" : "Ask"}
        </button>
      </form>
      {(error || runError) && (
        <p role="alert">
          {error ||
            (runError?.message.includes("resting") ||
            runError?.message.includes("descansa")
              ? runError.message
              : unavailable)}
        </p>
      )}
    </>
  );
}
