// Tests only: the model engine is the single boundary replaced here. The
// framework's completeText, engine selection and the app's reader run unchanged.
import { registerAgentEngine } from "@agent-native/core/agent/engine";

export const TEST_ENGINE = "eighty-test-reader";
export const sent = [];
const answers = [];

/** Queue the next model answer: text, or an Error to fail the request. */
export function answerWith(
  value,
  usage = { inputTokens: 1200, outputTokens: 300 },
) {
  answers.push({ value, usage });
}
export function pendingAnswers() {
  return answers.length;
}

registerAgentEngine({
  name: TEST_ENGINE,
  label: "Test reader",
  description: "Returns queued answers in tests.",
  capabilities: {
    thinking: false,
    promptCaching: false,
    vision: true,
    computerUse: false,
    parallelToolCalls: false,
  },
  defaultModel: "test-reader-model",
  supportedModels: ["test-reader-model"],
  requiredEnvVars: [],
  create: () => ({
    name: TEST_ENGINE,
    label: "Test reader",
    defaultModel: "test-reader-model",
    supportedModels: ["test-reader-model"],
    capabilities: {
      thinking: false,
      promptCaching: false,
      vision: true,
      computerUse: false,
      parallelToolCalls: false,
    },
    async *stream(options) {
      sent.push(options);
      const next = answers.shift();
      if (!next || next.value instanceof Error) {
        yield {
          type: "stop",
          reason: "error",
          error: next ? next.value.message : "No answer queued",
        };
        return;
      }
      yield { type: "text-delta", text: next.value };
      yield { type: "usage", ...next.usage };
      yield { type: "stop", reason: "end_turn" };
    },
  }),
});
