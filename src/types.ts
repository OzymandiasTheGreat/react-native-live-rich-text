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
  DISPLAY_TYPE.MENTION,
  DISPLAY_TYPE.CODE,
  DISPLAY_TYPE.CODE_BLOCK,
]
export const NEVER_TYPES = [
  DISPLAY_TYPE.MENTION,
  DISPLAY_TYPE.HTTP_LINK,
  DISPLAY_TYPE.PEAR_LINK,
  DISPLAY_TYPE.EMOJI,
]

export enum MentionType {
  ONE,
  TWO,
  THREE,
}

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

export interface AttributeStyle {
  mentionOne?: MarkdownStyle["mentionUser"]
  mentionTwo?: MarkdownStyle["mentionHere"]
  mentionThree?: MarkdownStyle["mentionReport"]
  link?: MarkdownStyle["link"]
  code?: MarkdownStyle["code"]
  codeBlock?: MarkdownStyle["pre"]
  emoji?: MarkdownStyle["emoji"]
}

export interface RichTextInputProps
  extends Omit<
    MarkdownTextInputProps,
    "markdownStyle" | "parser" | "formatSelection"
  > {
  attributes?: Attribute[]
  attributeStyle?: AttributeStyle
  mentionTypeWorklet?: (text: string, content: string | null) => MentionType
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
