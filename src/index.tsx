import React, {
  type ElementRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
  type TextInputSelectionChangeEventData,
} from "react-native"
import { runOnJS, runOnRuntime, useSharedValue } from "react-native-reanimated"
import {
  getWorkletRuntime,
  type MarkdownRange,
  type MarkdownStyle,
  MarkdownTextInput,
  type MarkdownType,
  parseExpensiMark,
} from "@expensify/react-native-live-markdown"
import {
  toEmoji as toEmojiOrig,
  toShortCode as toShortCodeOrig,
} from "emoji-index"
import * as linkify from "linkifyjs"
import {
  type Attribute,
  type AttributeStyle,
  BLOCK_TYPES,
  DEFAULT_PREFIX,
  DISPLAY_TYPE,
  EXCLUSIVE_TYPES,
  LINK_TYPES,
  MENTION_TYPE,
  NEVER_TYPES,
  PEAR_PROTOCOL,
  type PrefixTrigger,
  type PrefixType,
  type Protocol,
  type RichTextInputProps,
  type RichTextInputRef,
  SUPPORTED_MARKDOWN_TYPES,
  type TextInputSelection,
} from "./types"

type RichTextInput = ElementRef<typeof RichTextInput>

const RichTextInput = forwardRef<RichTextInputRef, RichTextInputProps>(
  (
    {
      value: valueProp = "",
      selection: selectionProp,
      attributes: attributesProp,
      attributeStyle = {},
      customLinkProtocols = [],
      prefixMaxLength = 140,
      prefixTrigger = DEFAULT_PREFIX,
      mentionTypeWorklet = defaultMentionTypeWorklet,
      toEmoji = toEmojiOrig,
      toShortCode = toShortCodeOrig,
      onChange: onChangeProp,
      onChangeText: onChangeTextProp,
      onSelectionChange: onSelectionChangeProp,
      onChangeAttributes,
      onChangeTypingAttributes,
      onChangePrefix,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<MarkdownTextInput>(null)
    const valueRef = useRef("")
    const selectionRef = useRef<TextInputSelection>({ start: 0, end: 0 })
    const iosSelectionOverrideRef = useRef<TextInputSelection | null>(null)
    const pushSelectionRef = useRef<TextInputSelection | null>(null)
    const attributesRef = useRef<Attribute[]>([])
    const currentAttributeRef = useRef<Attribute | null>(null)
    const typingAttributesRef = useRef<DISPLAY_TYPE[]>([])
    const emittedTextRef = useRef<string>()
    const emittedSelectionRef = useRef<TextInputSelection>()
    const emittedAttributesRef = useRef<Attribute[]>()
    const eventCount = useRef({
      attributes: 0,
      selection: 0,
      value: 0,
    })
    const propCount = useRef({
      attributes: -1,
      selection: -1,
      value: -1,
    })
    const [forceUpdate, setForceUpdate] = useState(false)
    const markdownStyle = useMemo(
      () => remapAttributeStyles(attributeStyle),
      [attributeStyle],
    )

    const [value, setValueState] = useState("")
    const [selection, setSelectionState] = useState<TextInputSelection>({
      start: 0,
      end: 0,
    })

    const sharedValue = useSharedValue("")
    const appliedAttributes = useSharedValue<Attribute[]>([])
    const typingAttributes = useSharedValue<DISPLAY_TYPE[]>([])

    useEffect(() => {
      for (const { scheme, optionalSlashSlash } of customLinkProtocols) {
        linkify.registerCustomProtocol(scheme, optionalSlashSlash)
      }
      linkify.init()
    }, [customLinkProtocols])

    const setValue = useCallback((value: string) => {
      valueRef.current = value
      setValueState(value)
    }, [])

    const setSelection = useCallback((selection: TextInputSelection) => {
      selectionRef.current = selection
      setSelectionState(selection)
    }, [])

    const hydrateValue = useCallback(
      (value: string, attributes: Attribute[]): string => {
        const current = currentAttributeRef.current
        let output = ""
        let offset = 0
        let end = 0

        for (const attr of attributes) {
          if (
            current &&
            current.type === attr.type &&
            current.content === attr.content &&
            current.start === attr.start &&
            current.length === attr.length
          ) {
            continue
          } else if (attr.type === DISPLAY_TYPE.EMOJI) {
            const emoji = toEmoji(attr.content)
            const shortCode =
              prefixTrigger.emoji + attr.content + prefixTrigger.emoji
            output += value.slice(end, attr.start + offset) + emoji
            offset += shortCode.length - attr.length
            end = attr.start + attr.length + offset
          } else if (attr.type === DISPLAY_TYPE.MENTION) {
            output +=
              value.slice(end, attr.start + offset) +
              prefixTrigger.mention +
              value.slice(
                attr.start + offset,
                attr.start + attr.length + offset,
              )
            offset -= prefixTrigger.mention.length
            end = attr.start + attr.length + offset
          }
        }

        if (end > 0) {
          output += value.slice(end)
        } else {
          output = value
        }

        return output
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const dehydrateValue = useCallback(
      (value: string): string => {
        const length = prefixTrigger.mention.length
        let output = ""
        let end = 0

        for (const attr of attributesRef.current) {
          if (attr.type === DISPLAY_TYPE.EMOJI) {
            const shortCode =
              prefixTrigger.emoji + attr.content + prefixTrigger.emoji
            output += value.slice(end, attr.start) + shortCode
          } else if (attr.type === DISPLAY_TYPE.MENTION) {
            const mention = value.slice(
              attr.start + length,
              attr.start + attr.length,
            )
            output += value.slice(end, attr.start) + mention
          } else {
            output += value.slice(end, attr.start + attr.length)
          }
          end = attr.start + attr.length
        }

        if (end > 0) {
          output += value.slice(end)
        } else {
          output = value
        }

        return output
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const hydrateSelection = useCallback(
      (selection: TextInputSelection): TextInputSelection => {
        let start = selection.start
        let end = selection.end

        for (const attr of attributesRef.current) {
          if (attr.start <= start) {
            if (attr.type === DISPLAY_TYPE.EMOJI) {
              const shortCode =
                prefixTrigger.emoji + attr.content + prefixTrigger.emoji
              start -= shortCode.length - attr.length
              end -= shortCode.length - attr.length
            } else if (
              attr.type === DISPLAY_TYPE.MENTION &&
              attr.start < start
            ) {
              start += prefixTrigger.mention.length
              end += prefixTrigger.mention.length
            }
          }
        }

        return { start, end }
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const dehydrateSelection = useCallback(
      (selection: TextInputSelection): TextInputSelection => {
        const length = prefixTrigger.mention.length
        let start = Math.min(selection.start, valueRef.current.length)
        let end = Math.min(selection.end, valueRef.current.length)

        for (const attr of attributesRef.current) {
          if (attr.start <= selection.start) {
            if (attr.type === DISPLAY_TYPE.EMOJI) {
              const shortCode =
                prefixTrigger.emoji + attr.content + prefixTrigger.emoji
              start += shortCode.length - attr.length
              end += shortCode.length - attr.length
            } else if (attr.type === DISPLAY_TYPE.MENTION) {
              start -= length
              end -= length
            }
          }
        }

        return { start, end }
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const hydrateAttributes = useCallback(
      (attributes: Attribute[]): Attribute[] => {
        const current = currentAttributeRef.current
        const output: Attribute[] = []
        let start = 0
        let length = prefixTrigger.mention.length

        for (const attr of attributes) {
          const attribute = { ...attr }
          attribute.start += start

          if (
            current &&
            current.type === attribute.type &&
            current.content === attribute.content &&
            current.start === attribute.start &&
            current.length === attribute.length
          ) {
            continue
          } else if (attribute.type === DISPLAY_TYPE.EMOJI) {
            const emoji = toEmoji(attribute.content)
            start -= attribute.length - emoji.length
            attribute.length = emoji.length
          } else if (attribute.type === DISPLAY_TYPE.MENTION) {
            start += length
            attribute.length += length
          }

          output.push(attribute)
        }

        return output
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const dehydrateAttributes = useCallback(
      (attributes: Attribute[]): Attribute[] => {
        const output: Attribute[] = []
        let start = 0
        let length = prefixTrigger.mention.length

        for (const attr of attributes) {
          const attribute = { ...attr }
          attribute.start -= start

          if (attribute.type === DISPLAY_TYPE.EMOJI) {
            const shortCode =
              prefixTrigger.emoji + attribute.content + prefixTrigger.emoji
            start -= shortCode.length - attribute.length
            attribute.length = shortCode.length
          } else if (attribute.type === DISPLAY_TYPE.MENTION) {
            start += length
            attribute.length -= length
          }

          output.push(attribute)
        }

        return output
      },
      [prefixTrigger.emoji, prefixTrigger.mention],
    )

    const calculatePrefix = useCallback(
      (
        text: string | null = null,
        start: number | null = null,
      ): [PrefixType, string | null] => {
        text ??= valueRef.current
        start ??= selectionRef.current.start
        let prefixType: PrefixType = null
        let prefixContent: string | null = null

        if (Object.values(prefixTrigger).some((t) => text.includes(t))) {
          const emojiTriggerPos = text.lastIndexOf(
            prefixTrigger.emoji,
            start - 1,
          )
          const mentionTriggerPos = text.lastIndexOf(
            prefixTrigger.mention,
            start - 1,
          )
          const nextSpacePos = text.indexOf(" ", start)
          let currentAttribute: Attribute | null = null

          for (const attr of attributesRef.current) {
            const attrEnd = attr.start + attr.length
            const pos = Math.max(emojiTriggerPos, mentionTriggerPos)

            if (
              EXCLUSIVE_TYPES.includes(attr.type) &&
              attr.start <= pos &&
              attrEnd >= start
            ) {
              currentAttribute = attr
              break
            } else if (
              attr.type === DISPLAY_TYPE.EMOJI &&
              attr.start === Math.max(emojiTriggerPos, mentionTriggerPos)
            ) {
              currentAttribute = attr
              break
            } else if (
              attr.type === DISPLAY_TYPE.MENTION &&
              attr.start === Math.max(emojiTriggerPos, mentionTriggerPos)
            ) {
              currentAttribute = attr
              break
            }
          }

          if (!EXCLUSIVE_TYPES.includes(currentAttribute?.type!)) {
            if (
              emojiTriggerPos >= 0 &&
              emojiTriggerPos > nextSpacePos &&
              emojiTriggerPos > mentionTriggerPos
            ) {
              const prefix = text.slice(
                emojiTriggerPos + prefixTrigger.emoji.length,
                start,
              )

              if (
                prefix.length < prefixMaxLength &&
                currentAttribute?.type !== DISPLAY_TYPE.EMOJI
              ) {
                prefixType = DISPLAY_TYPE.EMOJI
                prefixContent = prefix
              }
            } else if (
              mentionTriggerPos >= 0 &&
              mentionTriggerPos > emojiTriggerPos
            ) {
              const prefix = text.slice(
                mentionTriggerPos + prefixTrigger.mention.length,
                start,
              )

              if (
                prefix.length < prefixMaxLength &&
                currentAttribute?.type !== DISPLAY_TYPE.MENTION
              ) {
                prefixType = DISPLAY_TYPE.MENTION
                prefixContent = prefix
              }
            }
          }
        }

        return [prefixType, prefixContent]
      },
      [prefixMaxLength, prefixTrigger.emoji, prefixTrigger.mention],
    )

    const emitValue = useCallback(
      (e: string | NativeSyntheticEvent<TextInputChangeEventData>) => {
        const value = typeof e === "string" ? e : e.nativeEvent.text
        const text = dehydrateValue(value)

        const event: NativeSyntheticEvent<TextInputChangeEventData> =
          typeof e === "string"
            ? ({
                nativeEvent: { text, target: -1, eventCount: -1 },
              } as NativeSyntheticEvent<TextInputChangeEventData>)
            : { ...e, nativeEvent: { ...e.nativeEvent, text } }

        emittedTextRef.current = text
        eventCount.current.value++

        if (typeof onChangeProp === "function") {
          onChangeProp(event)
        }

        if (typeof onChangeTextProp === "function") {
          onChangeTextProp(text)
        }
      },
      [dehydrateValue, onChangeProp, onChangeTextProp],
    )

    const emitSelection = useCallback(
      (
        e:
          | TextInputSelection
          | NativeSyntheticEvent<TextInputSelectionChangeEventData>,
      ) => {
        const selectionEvent = "start" in e ? e : e.nativeEvent.selection
        const selection = dehydrateSelection(selectionEvent)
        const event: NativeSyntheticEvent<TextInputSelectionChangeEventData> =
          "start" in e
            ? ({
                nativeEvent: { selection, target: -1 },
              } as NativeSyntheticEvent<TextInputSelectionChangeEventData>)
            : {
                ...e,
                nativeEvent: {
                  ...e.nativeEvent,
                  selection,
                },
              }

        emittedSelectionRef.current = selection
        eventCount.current.selection++

        if (typeof onSelectionChangeProp === "function") {
          onSelectionChangeProp(event)
        }

        if (typeof onChangePrefix === "function") {
          const [type, prefix] = calculatePrefix(null, selectionEvent.start)
          onChangePrefix(type, prefix)
        }
      },
      [
        calculatePrefix,
        dehydrateSelection,
        onChangePrefix,
        onSelectionChangeProp,
      ],
    )

    const emitAttributes = useCallback(
      (attributes: Attribute[]) => {
        const dehydrated = dehydrateAttributes(attributes)

        attributesRef.current = attributes
        emittedAttributesRef.current = dehydrated
        eventCount.current.attributes++

        if (typeof onChangeAttributes === "function") {
          onChangeAttributes(dehydrated)
        }
      },
      [dehydrateAttributes, onChangeAttributes],
    )

    const emitTypingAttributes = useCallback(
      (types: DISPLAY_TYPE[]) => {
        typingAttributesRef.current = types

        if (typeof onChangeTypingAttributes === "function") {
          onChangeTypingAttributes(types)
        }
      },
      [onChangeTypingAttributes],
    )

    const calculateTypingAttributesWorker = useCallback(
      (selection: TextInputSelection) => {
        "worklet"

        const { start, end } = selection
        const types = new Set<DISPLAY_TYPE>()

        if (start === end) {
          for (const attr of appliedAttributes.value) {
            const attrEnd = attr.start + attr.length

            if (BLOCK_TYPES.includes(attr.type)) {
              if (value === sharedValue.value) {
                if (
                  sharedValue.value.charAt(end - 1) === "\n" &&
                  attr.start <= start &&
                  attrEnd === end
                ) {
                  continue
                } else if (attr.start <= start && attrEnd >= end) {
                  types.add(attr.type)
                }
              } else {
                if (attr.start <= start && attrEnd >= end) {
                  types.add(attr.type)
                }
              }
            } else if (value === sharedValue.value) {
              if (
                typingAttributes.value.includes(attr.type) &&
                attr.start < start &&
                attrEnd >= end
              ) {
                types.add(attr.type)
              } else if (attr.start < start && attrEnd > end) {
                types.add(attr.type)
              } else if (BLOCK_TYPES.includes(attr.type) && start === 0) {
                types.add(attr.type)
              }
            } else {
              if (attr.start < start && attrEnd >= end) {
                types.add(attr.type)
              }
            }
          }
        } else {
          for (const attr of appliedAttributes.value) {
            const attrEnd = attr.start + attr.length

            if (attr.start <= start && attrEnd >= end) {
              types.add(attr.type)
            }
          }
        }

        typingAttributes.value = [...types].filter(
          (type) => !NEVER_TYPES.includes(type) && !LINK_TYPES.includes(type),
        )

        runOnJS(emitTypingAttributes)(typingAttributes.value)
      },
      [emitTypingAttributes, selection, value],
    )

    const resetWorker = useCallback(
      (
        value?: string,
        selection?: TextInputSelection,
        attributes?: Attribute[],
      ) => {
        "worklet"

        sharedValue.value = value ?? ""
        appliedAttributes.value = attributes ?? []
        typingAttributes.value = []

        calculateTypingAttributesWorker(selection ?? { start: 0, end: 0 })
      },
      [calculateTypingAttributesWorker],
    )

    useEffect(() => {
      const { attributes: attributesCount } = eventCount.current
      const { attributes: attributesPropCount } = propCount.current

      if (
        attributesPropCount === attributesCount &&
        attributesProp !== emittedAttributesRef.current
      ) {
        propCount.current.attributes++
      } else {
        propCount.current.attributes = attributesCount
      }
    }, [attributesProp])

    useEffect(() => {
      const { selection: selectionCount } = eventCount.current
      const { selection: selectionPropCount } = propCount.current

      if (
        selectionPropCount === selectionCount &&
        selectionProp !== emittedSelectionRef.current
      ) {
        propCount.current.selection++
      } else {
        propCount.current.selection = selectionCount
      }
    }, [selectionProp])

    useEffect(() => {
      const { value: valueCount } = eventCount.current
      const { value: valuePropCount } = propCount.current

      if (
        valuePropCount === valueCount &&
        valueProp !== emittedTextRef.current
      ) {
        propCount.current.value++
      } else {
        propCount.current.value = valueCount
      }
    }, [valueProp])

    useEffect(() => {
      const {
        attributes: attributesCount,
        selection: selectionCount,
        value: valueCount,
      } = eventCount.current
      const {
        attributes: attributesPropCount,
        selection: selectionPropCount,
        value: valuePropCount,
      } = propCount.current

      if (
        attributesCount < attributesPropCount ||
        selectionCount < selectionPropCount ||
        valueCount < valuePropCount
      ) {
        const nextAttributes =
          attributesProp != null && attributesCount < attributesPropCount
            ? hydrateAttributes(attributesProp)
            : attributesRef.current
        const nextValue =
          valueProp != null
            ? hydrateValue(valueProp, nextAttributes)
            : valueRef.current
        const intermediateSelection =
          selectionProp != null
            ? hydrateSelection({
                ...selectionProp,
                end: selectionProp.end ?? selectionProp.start,
              })
            : selectionRef.current
        const nextSelection = {
          start: Math.min(intermediateSelection.start, nextValue.length),
          end: Math.min(intermediateSelection.end, nextValue.length),
        }

        propCount.current.attributes = attributesCount
        propCount.current.selection = selectionCount
        propCount.current.value = valueCount

        setValue(nextValue)
        setSelection(nextSelection)
        runOnRuntime(getWorkletRuntime(), resetWorker)(
          nextValue,
          nextSelection,
          nextAttributes,
        )
      }
    }, [
      attributesProp,
      hydrateAttributes,
      hydrateValue,
      resetWorker,
      selectionProp,
      setSelection,
      setValue,
      valueProp,
    ])

    const reset = useCallback(() => {
      setValue("")
      setSelection({ start: 0, end: 0 })
      runOnRuntime(getWorkletRuntime(), resetWorker)()
    }, [resetWorker, setValue])

    const formatCodeBlockWorker = useCallback(
      (type: DISPLAY_TYPE) => {
        "worklet"

        const { start, end } = selection
        const types = new Set(typingAttributes.value)
        const prevNewLine = value.lastIndexOf("\n", Math.max(0, start - 1))
        const nextNewLine = value.indexOf("\n", end)
        const lineStart = Math.max(0, prevNewLine)
        const lineEnd = nextNewLine > 0 ? nextNewLine + 1 : value.length
        const attributesToSplit: Attribute[] = []
        const attributes = appliedAttributes.value.filter((attr) => {
          const attrEnd = attr.start + attr.length

          if (
            attr.start < lineStart &&
            attrEnd > lineStart &&
            attrEnd <= lineEnd
          ) {
            attr.length = lineStart - attr.start
          } else if (
            attr.start >= lineStart &&
            attr.start < lineEnd &&
            attrEnd > lineEnd
          ) {
            attr.start = lineEnd
          } else if (attr.start < lineStart && attrEnd > lineEnd) {
            attributesToSplit.push(attr)
            return false
          }

          return !(attr.start >= lineStart && attrEnd <= lineEnd)
        })

        for (const attr of attributesToSplit) {
          attributes.push({ ...attr, length: lineStart - attr.start })
          attributes.push({
            ...attr,
            start: lineEnd,
            length: attr.start + attr.length - lineEnd,
          })
        }

        if (!types.has(type)) {
          attributes.push({
            type,
            content: null,
            start: lineStart,
            length: lineEnd - lineStart,
          })
        }

        appliedAttributes.value = attributes.sort((a, b) => a.start - b.start)
      },
      [selection, value],
    )

    const formatSelection = useCallback(
      (type: DISPLAY_TYPE, content: string | null = null) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, content: string | null) => {
            "worklet"

            const { start, end } = selection
            if (start === end) {
              const types = new Set(typingAttributes.value)

              if (EXCLUSIVE_TYPES.includes(type)) {
                if (BLOCK_TYPES.includes(type)) {
                  formatCodeBlockWorker(type)
                }

                const exists = types.has(type)

                types.clear()

                if (!exists) {
                  types.add(type)
                }
              } else {
                if (EXCLUSIVE_TYPES.some((type) => types.has(type))) {
                  types.clear()
                  types.add(type)
                } else {
                  if (types.has(type)) {
                    types.delete(type)
                  } else {
                    types.add(type)
                  }
                }
              }

              typingAttributes.value = [...types]

              if (BLOCK_TYPES.includes(type)) {
                runOnJS(setForceUpdate)((u) => !u)
              }
            } else {
              if (BLOCK_TYPES.includes(type)) {
                formatCodeBlockWorker(type)
              } else {
                const attributes: Attribute[] = []

                let attribute: Attribute | null = null

                for (const attr of appliedAttributes.value) {
                  const attrEnd = attr.start + attr.length

                  if (attr.start <= start && attrEnd >= end) {
                    if (attr.type === type) {
                      attribute = attr
                    } else if (
                      EXCLUSIVE_TYPES.includes(type) ||
                      EXCLUSIVE_TYPES.includes(attr.type)
                    ) {
                      continue
                    } else {
                      attributes.push(attr)
                    }
                    continue
                  }

                  if (attr !== attribute) {
                    attributes.push(attr)
                  }
                }

                if (attribute) {
                  if (start - attribute.start > 0) {
                    attributes.push({
                      type,
                      content,
                      start: attribute.start,
                      length: start - attribute.start,
                    })
                  }
                  if (attribute.start + attribute.length - end > 0) {
                    attributes.push({
                      type,
                      content,
                      start: end,
                      length: attribute.start + attribute.length - end,
                    })
                  }
                } else {
                  attributes.push({ type, content, start, length: end - start })
                }

                appliedAttributes.value = attributes.sort(
                  (a, b) => a.start - b.start,
                )
              }

              calculateTypingAttributesWorker(selection)
              runOnJS(setForceUpdate)((u) => !u)
            }

            runOnJS(emitTypingAttributes)(typingAttributes.value)
          },
        )(type, content)
      },
      [
        calculateTypingAttributesWorker,
        emitTypingAttributes,
        formatCodeBlockWorker,
        selection,
      ],
    )

    const complete = useCallback(
      (
        type: NonNullable<PrefixType>,
        text: string,
        content: string | null = null,
      ) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, text: string, content: string | null) => {
            "worklet"

            const { start } = selection
            const appendSpace = !/\s/.test(value.charAt(start))
            let position: number
            let prefix: string

            switch (type) {
              case DISPLAY_TYPE.MENTION: {
                prefix = prefixTrigger.mention
                position = value.lastIndexOf(prefix, start)
                break
              }
              case DISPLAY_TYPE.EMOJI: {
                prefix = prefixTrigger.emoji
                position = value.lastIndexOf(prefix, start)
                break
              }
              default:
                return
            }

            if (start - position > prefixMaxLength) {
              return
            }

            const nextValue =
              value.slice(0, position) +
              (type === DISPLAY_TYPE.EMOJI ? "" : prefix) +
              text +
              (appendSpace ? " " : "") +
              value.slice(start)
            const nextPosition =
              position +
              text.length +
              (appendSpace ? 1 : 0) +
              (type === DISPLAY_TYPE.EMOJI ? 0 : prefix.length)
            const nextSelection = { start: nextPosition, end: nextPosition }
            const attributes: Attribute[] = []

            for (const attr of appliedAttributes.value) {
              const attrEnd = attr.start + attr.length - (start - position)

              if (EXCLUSIVE_TYPES.includes(type)) {
                if (
                  BLOCK_TYPES.some((type) => attr.type === type) &&
                  attr.start <= position &&
                  attrEnd > position
                ) {
                  continue
                }

                if (attr.start <= position && attrEnd > position) {
                  const prev = { ...attr, length: attrEnd - position }
                  const next = {
                    ...attr,
                    start: nextPosition,
                    length: attrEnd - position,
                  }

                  if (prev.length > 0) {
                    attributes.push(prev)
                  }

                  if (next.length > 0) {
                    attributes.push(next)
                  }
                } else if (
                  attr.start <= position &&
                  attr.start + attr.length > position
                ) {
                  attr.length -= attr.start + attr.length - position

                  attributes.push(attr)
                } else if (attr.start >= position) {
                  attr.start = position + prefix.length - position

                  attributes.push(attr)
                } else {
                  attributes.push(attr)
                }
              } else {
                attributes.push(attr)
              }
            }

            attributes.push({
              type,
              content,
              start: position,
              length:
                text.length + (type === DISPLAY_TYPE.EMOJI ? 0 : prefix.length),
            })

            sharedValue.value = nextValue
            appliedAttributes.value = attributes.sort(
              (a, b) => a.start - b.start,
            )

            calculateTypingAttributesWorker(selection)

            runOnJS(setValue)(nextValue)
            runOnJS(setSelection)(nextSelection)
            runOnJS(emitAttributes)(attributes)
            runOnJS(emitValue)(nextValue)
            runOnJS(emitSelection)(nextSelection)
          },
        )(type, text, content)
      },
      [
        emitAttributes,
        emitSelection,
        emitValue,
        prefixMaxLength,
        prefixTrigger,
        selection,
        setSelection,
        setValue,
        value,
      ],
    )

    useImperativeHandle(
      ref,
      () =>
        ({
          ...inputRef.current,
          complete,
          formatSelection,
          reset,
        } as RichTextInputRef),
      [complete, formatSelection, reset],
    )

    const onSelectionChange = useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const selection = pushSelectionRef.current ??
          iosSelectionOverrideRef.current ?? {
            ...e.nativeEvent.selection,
          }
        const attribute = attributesRef.current.find((attr) => {
          const { start, end } = selection
          const attrEnd = attr.start + attr.length

          return (
            NEVER_TYPES.includes(attr.type) &&
            ((attr.start < start && attrEnd > end) ||
              (attr.start > start && attr.start < end) ||
              (attrEnd > start && attrEnd < end))
          )
        })

        if (currentAttributeRef.current) {
          const { start } = currentAttributeRef.current
          selection.start = start
          selection.end = start
        } else if (attribute) {
          const attrEnd = attribute.start + attribute.length

          if (selection.start === selection.end) {
            const position =
              selection.start - attribute.start > attrEnd - selection.end
                ? attribute.start
                : attrEnd
            selection.start = position
            selection.end = position
          } else {
            selection.start = Math.min(attribute.start, selection.start)
            selection.end = Math.max(attrEnd, selection.end)
          }
        }

        pushSelectionRef.current = null
        setSelection(selection)
        runOnRuntime(
          getWorkletRuntime(),
          calculateTypingAttributesWorker,
        )(selection)
        emitSelection({ ...e, nativeEvent: { ...e.nativeEvent, selection } })
      },
      [calculateTypingAttributesWorker, emitSelection, setSelection, value],
    )

    const onChangeWorker = useCallback(
      (text: string, length: number, extraAttributes: Attribute[]) => {
        "worklet"

        const prevAttributes = appliedAttributes.value
        const nextAttributes: Attribute[] = extraAttributes
        const { start, end } = selection
        const types = new Set(typingAttributes.value)
        const next = text.slice(end, end + length)

        for (const attr of prevAttributes) {
          const attrEnd = attr.start + attr.length

          if (
            extraAttributes.find(
              (extra) => attr.type === extra.type && attr.start === extra.start,
            )
          ) {
            continue
          }

          if (types.has(attr.type) && attr.start <= start && attrEnd >= end) {
            types.delete(attr.type)

            if (attr.type === DISPLAY_TYPE.CODE) {
              if (!next.startsWith("\n")) {
                if (next.includes("\n")) {
                  attr.length += next.indexOf("\n")
                } else {
                  attr.length += length
                }
              }
            } else {
              attr.length += length
            }
          } else if (!types.has(attr.type) && attrEnd === start && length < 0) {
            attr.length += length
          } else if (attr.start >= start) {
            if (NEVER_TYPES.includes(attr.type)) {
              continue
            }

            attr.start += length
          }

          if (attrEnd > text.length && text.length - attrEnd >= length) {
            attr.length = text.length - attr.start
          }

          if (attr.start < 0 || attr.length <= 0) {
            continue
          }

          if (!NEVER_TYPES.includes(attr.type)) {
            const prevAttr = nextAttributes.find((prev) => {
              const prevEnd = prev.start + prev.length

              return attr.type === prev.type && attr.start <= prevEnd
            })

            if (prevAttr) {
              prevAttr.length +=
                prevAttr.start + prevAttr.length - attr.start + attr.length
              continue
            }
          }

          nextAttributes.push(attr)
        }

        if (length > 0) {
          for (const type of types) {
            if (type === DISPLAY_TYPE.CODE) {
              const index = next.indexOf("\n")

              nextAttributes.push({
                type,
                content: null,
                start,
                length: index < 0 ? length : index,
              })
            } else {
              nextAttributes.push({ type, content: null, start, length })
            }
          }
        }

        if (!text) {
          runOnJS(setSelection)({ start: 0, end: 0 })
          calculateTypingAttributesWorker(selection)
        }

        sharedValue.value = text
        appliedAttributes.value = nextAttributes.sort(
          (a, b) => a.start - b.start,
        )

        runOnJS(emitAttributes)(nextAttributes)
      },
      [emitAttributes, selection],
    )

    const onChange = useCallback(
      (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        let text = e.nativeEvent.text
        const prev = valueRef.current
        const { start, end } = selection
        const types = new Set(typingAttributesRef.current)
        const [type, prefix] = calculatePrefix(text)
        const extraAttributes: Attribute[] = []
        const length = text.length - prev.length
        const next = text.slice(end, end + length)
        let currentAttr: Attribute | null = null

        if (length === currentAttributeRef.current?.length) {
          currentAttributeRef.current = null
          return
        }

        for (const attr of attributesRef.current) {
          const attrEnd = attr.start + attr.length

          if (NEVER_TYPES.includes(attr.type)) {
            if (!types.has(attr.type) && attrEnd === start && length < 0) {
              currentAttr = { ...attr }
            } else if (attr.start >= start) {
              currentAttr = { ...attr }
            } else if (
              attrEnd > text.length &&
              text.length - attrEnd >= length
            ) {
              currentAttr = { ...attr }
            }
          }
        }

        if (length < 0 && currentAttr) {
          const attrEnd = currentAttr.start + currentAttr.length
          text = prev.slice(0, currentAttr.start) + prev.slice(attrEnd + 1)
        }

        currentAttributeRef.current = currentAttr

        if (type === DISPLAY_TYPE.EMOJI && next === prefixTrigger.emoji) {
          const emoji = toEmoji(prefix)

          if (emoji) {
            const pos = start - prefixTrigger.emoji.length - prefix!.length
            text = prev.slice(0, pos) + emoji + " " + prev.slice(start)
            extraAttributes.push({
              type: DISPLAY_TYPE.EMOJI,
              content: prefix,
              start: pos,
              length: emoji.length,
            })
          }
        } else if (length > 1) {
          const shortCodeRegex = new RegExp(
            prefixTrigger.emoji + "([\\w\\-+]+?)" + prefixTrigger.emoji,
            "g",
          )
          let emojified = ""
          let offset = 0

          for (const match of next.matchAll(shortCodeRegex)) {
            const emoji = toEmoji(match[1])

            if (emoji) {
              const index = next.indexOf(match[0], offset)
              const prefix = next.slice(offset, index)
              emojified += prefix + emoji
              offset += prefix.length + match[0].length
            }
          }

          emojified += next.slice(offset)
          text = text.slice(0, end) + emojified + text.slice(end + length)
        }

        const ranges = parseExpensiMark(text)
        let offset = 0

        for (const range of ranges) {
          const type = markdown2display(range.type)
          const current = attributesRef.current.find((attr) => {
            const attrEnd = attr.start + attr.length + length
            const start = range.start
            const end = range.start + range.length

            return attr.start <= start && attrEnd >= end
          })

          if (range.type === "syntax") {
            const prev = ranges.find(
              (attr) =>
                attr.type === "pre" &&
                attr.start === range.start + range.length,
            )
            const next = ranges.find(
              (attr) =>
                attr.type === "pre" && attr.start + attr.length === range.start,
            )

            if (
              !current ||
              !(prev || next || EXCLUSIVE_TYPES.includes(current.type))
            ) {
              const before =
                text.slice(range.start - offset - 1, range.start - offset) ===
                  "\n" && !!prev
                  ? 1
                  : 0
              const after =
                text.slice(
                  range.start - offset + range.length,
                  range.start - offset + range.length + 1,
                ) === "\n" && !!next
                  ? 1
                  : 0
              text =
                text.slice(0, range.start - offset - before) +
                text.slice(range.start - offset + range.length + after)
              offset += range.length + before + after
            }
          } else if (range.type === "emoji") {
            const shortCode = toShortCode(
              text.slice(
                range.start - offset,
                range.start - offset + range.length,
              ),
            )
            extraAttributes.push({
              type: DISPLAY_TYPE.EMOJI,
              content: shortCode,
              start: range.start - offset,
              length: range.length,
            })
          } else if (SUPPORTED_MARKDOWN_TYPES.includes(range.type)) {
            if (
              !current ||
              !(
                EXCLUSIVE_TYPES.includes(type!) ||
                EXCLUSIVE_TYPES.includes(current.type)
              )
            ) {
              extraAttributes.push({
                type: type!,
                content: null,
                start: range.start - offset,
                length: range.length,
              })
            }
          }
        }

        if (offset > 0) {
          pushSelectionRef.current = {
            start: start - offset + length,
            end: end - offset + length,
          }
        }

        for (const link of linkify.find(text)) {
          const type = link.href.startsWith(PEAR_PROTOCOL)
            ? DISPLAY_TYPE.PEAR_LINK
            : DISPLAY_TYPE.HTTP_LINK
          const length = link.end - link.start

          if (link.start < start && link.end > end) {
            pushSelectionRef.current = { start: link.end, end: link.end }
          }

          extraAttributes.push({
            type,
            content: link.href,
            start: link.start,
            length,
          })
        }

        iosSelectionOverrideRef.current = (e.nativeEvent as any).selection
        attributesRef.current = [
          ...attributesRef.current,
          ...extraAttributes,
        ].sort((a, b) => a.start - b.start)
        runOnRuntime(getWorkletRuntime(), onChangeWorker)(
          text,
          length,
          extraAttributes,
        )
        setValue(text)
        emitValue({ ...e, nativeEvent: { ...e.nativeEvent, text } })
      },
      [
        calculatePrefix,
        emitValue,
        onChangeWorker,
        prefixMaxLength,
        prefixTrigger.emoji,
        prefixTrigger.mention,
        setValue,
      ],
    )

    const parser = useCallback(
      (text: string): MarkdownRange[] => {
        "worklet"

        const ranges: MarkdownRange[] = []

        for (const attr of appliedAttributes.value) {
          const attrEnd = attr.start + attr.length
          let type: MarkdownType
          let start = Math.max(0, attr.start)
          let length = attrEnd < text.length ? attr.length : text.length - start

          if (length < 1 || start >= text.length) {
            continue
          }

          switch (attr.type) {
            case DISPLAY_TYPE.BOLD:
              type = "bold"
              break
            case DISPLAY_TYPE.ITALIC:
              type = "italic"
              break
            case DISPLAY_TYPE.STRIKE_THROUGH:
              type = "strikethrough"
              break
            case DISPLAY_TYPE.CODE:
              type = "code"
              break
            case DISPLAY_TYPE.CODE_BLOCK:
              type = "pre"
              break
            case DISPLAY_TYPE.MENTION:
              const mentionType = mentionTypeWorklet(
                text.slice(
                  attr.start + prefixTrigger.mention.length,
                  attr.start + attr.length,
                ),
                attr.content,
              )

              switch (mentionType) {
                case MENTION_TYPE.ONE:
                  type = "mention-user"
                  break
                case MENTION_TYPE.TWO:
                  type = "mention-here"
                  break
                case MENTION_TYPE.THREE:
                  type = "mention-report"
                  break
                default:
                  console.error("Unknown Mention type")
                  type = "mention-user"
              }
              break
            case DISPLAY_TYPE.EMOJI:
              type = "emoji"
              break
            case DISPLAY_TYPE.HTTP_LINK:
            case DISPLAY_TYPE.PEAR_LINK:
              type = "link"
              break
            default:
              console.error("Unknown Display type")
              continue
          }

          ranges.push({ type, start, length })
        }

        return ranges
      },
      [
        // Needed when applying attributes outside regular cycle, e.g. formatSelection
        forceUpdate,
        // Needed because parser runs before onChangeWorker and latest changes aren't applied on time
        value,
        // The rest are used within, so unavoidable
        mentionTypeWorklet,
        prefixTrigger.mention,
      ],
    )

    return (
      <MarkdownTextInput
        {...props}
        ref={inputRef}
        markdownStyle={markdownStyle}
        parser={parser}
        value={value}
        onChange={onChange}
        selection={selection}
        onSelectionChange={onSelectionChange}
      />
    )
  },
)

export default RichTextInput

export { DISPLAY_TYPE, MENTION_TYPE }

export type {
  Attribute,
  AttributeStyle,
  PrefixTrigger,
  PrefixType,
  Protocol,
  RichTextInputProps,
  RichTextInputRef,
  TextInputSelection,
}

function markdown2display(type: MarkdownType): DISPLAY_TYPE | null {
  switch (type) {
    case "mention-here":
    case "mention-report":
    case "mention-short":
    case "mention-user":
      return DISPLAY_TYPE.MENTION
    case "link":
      return DISPLAY_TYPE.HTTP_LINK
    case "bold":
      return DISPLAY_TYPE.BOLD
    case "italic":
      return DISPLAY_TYPE.ITALIC
    case "code":
      return DISPLAY_TYPE.CODE
    case "emoji":
      return DISPLAY_TYPE.EMOJI
    case "pre":
      return DISPLAY_TYPE.CODE_BLOCK
    case "strikethrough":
      return DISPLAY_TYPE.STRIKE_THROUGH
    case "syntax":
    case "blockquote":
    case "h1":
    case "inline-image":
    default:
      return null
  }
}

function remapAttributeStyles(attributeStyle: AttributeStyle): MarkdownStyle {
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

function defaultMentionTypeWorklet(
  text: string,
  content: string | null,
): MENTION_TYPE {
  "worklet"

  return MENTION_TYPE.ONE
}
