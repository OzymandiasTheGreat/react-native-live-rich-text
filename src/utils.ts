import { Attribute, DISPLAY_TYPE, TextInputSelection } from "./types"

export function hydrateMentions(
  text: string,
  attributes: Attribute[],
): [string, Attribute[]] {
  const attrs = [...attributes.map((attr) => ({ ...attr }))]
  let output = ""
  let position = 0
  let index = 0

  for (const mention of attrs) {
    if (mention.type !== DISPLAY_TYPE.MENTION) {
      continue
    }

    const end = mention.start + mention.length + index
    output += text.slice(position, mention.start)
    output += `@${text.slice(mention.start, end)}`
    mention.start += index
    mention.length++
    position = end
    index++
  }
  output += text.slice(position)
  return [output, attrs]
}

export function dehydrateMentions(
  text: string,
  attributes: Attribute[],
): [string, Attribute[]] {
  const attrs = [...attributes.map((attr) => ({ ...attr }))]
  let output = ""
  let position = 0
  let index = 0

  for (const mention of attrs) {
    if (mention.type !== DISPLAY_TYPE.MENTION) {
      continue
    }

    const end = mention.start + mention.length - index
    output += text.slice(position, mention.start)
    output += text.slice(mention.start - index + 1, end)
    mention.start -= index
    mention.length--
    position = end
    index++
  }
  output += text.slice(position)
  return [output, attrs]
}
