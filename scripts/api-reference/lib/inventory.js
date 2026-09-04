// The names of everything the reference is expected to document, derived
// from the descriptor.
//
// This is names only, deliberately. The on-chain runners fill values from
// what a page states, never from the descriptor, because a filler that reads
// the descriptor can pass while the page is wrong. Asking the descriptor
// which methods should exist does not weaken that: it is the question of
// coverage, not the question of what a field contains.

/**
 * @param {Array} modules - modules as produced by parseDescriptor().
 * @returns {{queries: string[], messages: string[]}} both arrays sorted.
 */
export function buildInventory(modules) {
  const queries = [];
  const messages = [];

  for (const module of modules) {
    for (const service of module.services) {
      for (const method of service.methods) {
        if (service.kind === 'query') queries.push(method.fullName);
        if (service.kind === 'msg') messages.push(method.inputType);
      }
    }
  }

  return { queries: [...new Set(queries)].sort(), messages: [...new Set(messages)].sort() };
}
