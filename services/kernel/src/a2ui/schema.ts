import { z } from "zod";

/**
 * A2UI declarative UI spec (D-0061). Agent-generated UI as DATA, not code.
 *
 * SAFETY BY CONSTRUCTION (the whole reason this is safe to let an agent emit):
 *  - The component vocabulary is a CLOSED WHITELIST. There is deliberately no
 *    `html`, `script`, `iframe`, `url`, `link`, or `image` component — nothing
 *    that can execute code, navigate, or load a remote resource.
 *  - The only interactive components are `setting`/`settingsGroup` (which edit a
 *    CATALOGUED setting via the existing `PUT /settings` contract) and `action`
 *    (which invokes a REGISTERED gated tool via `/core/run-tool`, i.e. through
 *    policy → approval → audit). A generated panel can therefore only do what
 *    the user could already do through the safe contracts.
 *  - Strings are plain text (rendered as text, never HTML).
 * The kernel validates a spec against this schema on write; the client validates
 * again before rendering (defense in depth). Both reject unknown component types.
 */

const Heading = z.object({ type: z.literal("heading"), text: z.string().min(1).max(120) });
const Text = z.object({ type: z.literal("text"), text: z.string().min(1).max(2000) });
/** render the editor for one catalogued setting (edits via PUT /settings) */
const Setting = z.object({ type: z.literal("setting"), key: z.string().min(1).max(120) });
/** render all settings in a category */
const SettingsGroup = z.object({ type: z.literal("settingsGroup"), category: z.string().min(1).max(80) });
/** a button that invokes a REGISTERED gated tool (goes through approval) */
const Action = z.object({
  type: z.literal("action"),
  label: z.string().min(1).max(80),
  tool: z.string().min(1).max(120),
  args: z.record(z.string(), z.unknown()).optional(),
  confirm: z.string().max(200).optional(),
});

export const A2uiComponentSchema = z.discriminatedUnion("type", [
  Heading,
  Text,
  Setting,
  SettingsGroup,
  Action,
]);
export type A2uiComponent = z.infer<typeof A2uiComponentSchema>;

export const A2uiSpecSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  components: z.array(A2uiComponentSchema).min(1).max(60),
});
export type A2uiSpec = z.infer<typeof A2uiSpecSchema>;

/**
 * Cross-reference validation the schema alone can't do: every `setting`/
 * `settingsGroup`/`action` must reference something that actually exists, so a
 * generated panel can never point at a non-existent (or smuggled) target.
 */
export function validateReferences(
  spec: A2uiSpec,
  refs: { hasSetting: (key: string) => boolean; hasCategory: (cat: string) => boolean; hasTool: (name: string) => boolean },
): string[] {
  const errors: string[] = [];
  for (const c of spec.components) {
    if (c.type === "setting" && !refs.hasSetting(c.key)) errors.push(`unknown setting '${c.key}'`);
    if (c.type === "settingsGroup" && !refs.hasCategory(c.category)) errors.push(`unknown settings category '${c.category}'`);
    if (c.type === "action" && !refs.hasTool(c.tool)) errors.push(`unknown tool '${c.tool}'`);
  }
  return errors;
}
