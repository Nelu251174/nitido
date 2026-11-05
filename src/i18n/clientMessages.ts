import {textKey, type UiCatalog} from './text';

const sourceOverrides = new WeakMap<UiCatalog, UiCatalog>();

/** Source copy is already present in UI components; only Romanian overrides need shipping. */
export function clientMessages<T extends Record<string, unknown>>(locale: string, messages: T): T {
  if (locale !== 'ro' || !messages.ui || typeof messages.ui !== 'object' || Array.isArray(messages.ui)) return messages;
  const entries = Object.entries(messages.ui);
  if (entries.some(([, value]) => typeof value !== 'string')) return messages;
  const source = messages.ui as UiCatalog;
  let ui = sourceOverrides.get(source);
  if (!ui) {
    ui = Object.fromEntries(Object.entries(source).filter(([key, value]) => textKey(value) !== key));
    sourceOverrides.set(source, ui);
  }
  // Country, FX rate and every other request-specific namespace stay request-local.
  return {...messages, ui};
}
