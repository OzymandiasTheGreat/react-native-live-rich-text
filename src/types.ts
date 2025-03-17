import type { TextInputSelectionChangeEventData } from "react-native"
import type {
  MarkdownStyle,
  MarkdownTextInput,
  MarkdownTextInputProps,
} from "@expensify/react-native-live-markdown"

export enum DISPLAY_TYPE {
  MENTION = 1,
  HTTP_LINK,
  PEAR_LINK,
  BOLD,
  ITALIC,
  CODE,
  EMOJI,
  CODE_BLOCK,
  STRIKE_THROUGH,
}

export const BLOCK_TYPES = [DISPLAY_TYPE.CODE_BLOCK]
export const EXCLUSIVE_TYPES = [
  DISPLAY_TYPE.CODE,
  DISPLAY_TYPE.CODE_BLOCK,
  DISPLAY_TYPE.MENTION,
]

export interface PrefixTrigger {
  emoji: string
  mention: string
}

export const DEFAULT_PREFIX: PrefixTrigger = {
  emoji: ":",
  mention: "@",
}

export type Attribute = {
  start: number
  length: number
  type: DISPLAY_TYPE
  content: string | null
}

export type TextInputSelection = TextInputSelectionChangeEventData["selection"]

export interface RichTextInputProps
  extends Omit<
    MarkdownTextInputProps,
    "markdownStyle" | "parser" | "formatSelection"
  > {
  attributes?: Attribute[]
  attributeStyle?: Omit<MarkdownStyle, "syntax">
  prefixMaxLength?: number
  prefixTrigger?: PrefixTrigger
  onChangeAttributes?: (attributes: Attribute[]) => void
  onChangeTypingAttributes?: (typingAttributes: DISPLAY_TYPE[]) => void
  onChangePrefix?: (type: DISPLAY_TYPE | null, prefix: string | null) => void
}

export type RichTextInputRef = MarkdownTextInput & {
  reset: () => void
  formatSelection: (type: DISPLAY_TYPE, content?: string | null) => void
  complete: (type: DISPLAY_TYPE, text: string, content?: string | null) => void
}
