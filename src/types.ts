import type { TextInputSelectionChangeEventData } from "react-native"
import type {
  MarkdownStyle,
  MarkdownTextInput,
  MarkdownTextInputProps,
  MarkdownType,
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

export const SUPPORTED_MARKDOWN_TYPES: MarkdownType[] = [
  "bold",
  "code",
  "emoji",
  "italic",
  "pre",
  "strikethrough",
]

export const BLOCK_TYPES = [DISPLAY_TYPE.CODE_BLOCK]
export const EXCLUSIVE_TYPES = [
  DISPLAY_TYPE.MENTION,
  DISPLAY_TYPE.HTTP_LINK,
  DISPLAY_TYPE.PEAR_LINK,
  DISPLAY_TYPE.CODE,
  DISPLAY_TYPE.CODE_BLOCK,
]
export const LINK_TYPES = [DISPLAY_TYPE.HTTP_LINK, DISPLAY_TYPE.PEAR_LINK]
export const NEVER_TYPES = [DISPLAY_TYPE.MENTION, DISPLAY_TYPE.EMOJI]

export enum MENTION_TYPE {
  ONE,
  TWO,
  THREE,
}

export type ManualType =
  | DISPLAY_TYPE.BOLD
  | DISPLAY_TYPE.CODE
  | DISPLAY_TYPE.CODE_BLOCK
  | DISPLAY_TYPE.ITALIC
  | DISPLAY_TYPE.STRIKE_THROUGH
export type PrefixType = DISPLAY_TYPE.EMOJI | DISPLAY_TYPE.MENTION | null

export interface PrefixTrigger {
  emoji: string
  mention: string
}

export const PEAR_PROTOCOL = "pear://"

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

export type Protocol = { scheme: string; optionalSlashSlash: boolean }

export interface RichTextInputProps
  extends Omit<
    MarkdownTextInputProps,
    "markdownStyle" | "parser" | "formatSelection"
  > {
  attributes?: Attribute[]
  attributeStyle?: AttributeStyle
  customLinkProtocols?: Protocol[]
  prefixMaxLength?: number
  prefixTrigger?: PrefixTrigger
  mentionTypeWorklet?: (text: string, content: string | null) => MENTION_TYPE
  toEmoji?: (shortCode: string) => string
  toShortCode?: (emoji: string) => string
  onChangeAttributes?: (attributes: Attribute[]) => void
  onChangeTypingAttributes?: (typingAttributes: DISPLAY_TYPE[]) => void
  onChangePrefix?: (type: PrefixType, prefix: string | null) => void
}

export type RichTextInputRef = MarkdownTextInput & {
  reset: () => void
  formatSelection: (type: ManualType, content?: string | null) => void
  complete: (
    type: NonNullable<PrefixType>,
    text: string,
    content?: string | null,
  ) => void
}
