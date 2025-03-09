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

export const EXCLUSIVE_TYPES = [DISPLAY_TYPE.CODE, DISPLAY_TYPE.CODE_BLOCK]

export type Attribute = {
  start: number
  length: number
  type: DISPLAY_TYPE
  content: string | null
}

export type TextState = { prev: string; next: string }

export type TextInputSelection = TextInputSelectionChangeEventData["selection"]

export type SelectionState = {
  prev: TextInputSelection
  next: TextInputSelection
}

export interface RichTextInputProps
  extends Omit<
    MarkdownTextInputProps,
    "markdownStyle" | "parser" | "formatSelection"
  > {
  attributes?: Attribute[]
  attributeStyle?: Omit<MarkdownStyle, "syntax">
  prefixMaxLength?: number
  onChangeAttributes?: (attributes: Attribute[]) => void
  onChangeTypingAttributes?: (typingAttributes: DISPLAY_TYPE[]) => void
  onChangePrefix?: (prefix: string) => void
}

export type RichTextInputRef = MarkdownTextInput & {
  formatSelection: (type: DISPLAY_TYPE, content?: string | null) => void
  complete: (type: DISPLAY_TYPE, text: string, content?: string | null) => void
}
