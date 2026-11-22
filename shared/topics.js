/** Global ranks returned by the captured course catalog. Catalog groups keep their own order. */
/** @type {Readonly<Record<string, number>>} */
export const topicRanks = Object.freeze({
  'foundational-math': 1, algebra: 2, 'intermediate-algebra': 3, 'advanced-algebra': 4,
  'advanced-math': 5, 'computer-science': 6, python: 7, 'data-analysis': 8,
  science: 9, 'logical-reasoning': 10, 'everyday-math': 11, technology: 12,
  'mind-bending-math': 13,
})
export const initialPinnedTopics = ['computer-science', 'data-analysis']
/** @param {unknown} value @returns {string[]} */
export function parsePinnedTopics(value) {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !Object.hasOwn(topicRanks, id))
    || new Set(value).size !== value.length) throw new Error('Invalid saved topics.')
  return [...value].sort((a, b) => topicRanks[a] - topicRanks[b])
}
/** @param {unknown} value @returns {{slug: string, pinned: boolean}} */
export function parseTopicChange(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2 || !('slug' in value) || !('pinned' in value)
    || typeof value.slug !== 'string' || !Object.hasOwn(topicRanks, value.slug)
    || typeof value.pinned !== 'boolean') throw new Error('Invalid topic change.')
  return { slug: value.slug, pinned: value.pinned }
}
