import type { MarkdownStyle } from "@expensify/react-native-live-markdown"
import { type AttributeStyle } from "./types"

export function remapAttributeStyles(
  attributeStyle: AttributeStyle,
): MarkdownStyle {
  const style: MarkdownStyle = {}

  for (const key of Object.keys(attributeStyle) as (keyof AttributeStyle)[]) {
    switch (key) {
      case "mentionOne":
        style["mentionUser"] = attributeStyle[key]
        break
      case "mentionTwo":
        style["mentionHere"] = attributeStyle[key]
        break
      case "mentionThree":
        style["mentionReport"] = attributeStyle[key]
        break
      case "link":
        style["link"] = attributeStyle[key]
        break
      case "code":
        style["code"] = attributeStyle[key]
        break
      case "codeBlock":
        style["pre"] = attributeStyle[key]
        break
      case "emoji":
        style["emoji"] = attributeStyle[key]
        break
      default:
        console.error(`Unknown key in AttributeStyle: ${key}`)
    }
  }

  return style
}
