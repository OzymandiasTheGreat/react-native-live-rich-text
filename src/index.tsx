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
} from "@expensify/react-native-live-markdown"
import {
  type Attribute,
  type AttributeStyle,
  BLOCK_TYPES,
  DEFAULT_PREFIX,
  DISPLAY_TYPE,
  EXCLUSIVE_TYPES,
  MENTION_TYPE,
  NEVER_TYPES,
  type PrefixTrigger,
  type RichTextInputProps,
  type RichTextInputRef,
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
      prefixMaxLength = 140,
      prefixTrigger = DEFAULT_PREFIX,
      mentionTypeWorklet = defaultMentionTypeWorklet,
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
    const textRef = useRef("")
    const selectionRef = useRef<TextInputSelection>({ start: 0, end: 0 })
    const attributeRef = useRef<Attribute[]>([])
    const currentAttributeRef = useRef<Attribute | null>(null)
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

    const sharedText = useSharedValue("")
    const sharedSelection = useSharedValue<TextInputSelection>({
      start: 0,
      end: 0,
    })
    const appliedAttributes = useSharedValue<Attribute[]>([])
    const typingAttributes = useSharedValue<DISPLAY_TYPE[]>([])

    const setValue = useCallback((value: string) => {
      textRef.current = value
      setValueState(value)
    }, [])

    const setSelection = useCallback((selection: TextInputSelection) => {
      selectionRef.current = selection
      setSelectionState(selection)
    }, [])

    const hydrateValue = useCallback(
      (value: string): string => {
        const current = currentAttributeRef.current
        let output = ""
        let start = 0
        let end = 0
        let prefix = prefixTrigger.mention

        for (const attr of attributeRef.current) {
          const attrEnd = attr.start + attr.length - start

          if (
            current &&
            current.type === attr.type &&
            current.content === attr.content &&
            current.start === attr.start &&
            current.length === attr.length
          ) {
            continue
          } else if (attr.type === DISPLAY_TYPE.MENTION) {
            const mention = prefix + value.slice(attr.start - start, attrEnd)
            output += value.slice(end, attr.start - start) + mention
            start += prefix.length
          } else {
            output += value.slice(end, attrEnd)
          }
          end = attrEnd
        }

        if (end > 0) {
          output += value.slice(end)
        } else {
          output = value
        }

        return output
      },
      [prefixTrigger.mention],
    )

    const dehydrateValue = useCallback(
      (value: string): string => {
        let output = ""
        let end = 0
        let length = prefixTrigger.mention.length

        if (value.includes(prefixTrigger.mention)) {
          for (const attr of attributeRef.current) {
            if (attr.type === DISPLAY_TYPE.MENTION) {
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
        }

        if (end > 0) {
          output += value.slice(end)
        } else {
          output = value
        }

        return output
      },
      [prefixTrigger.mention],
    )

    const hydrateSelection = useCallback(
      (selection: TextInputSelection): TextInputSelection => {
        const length = prefixTrigger.mention.length
        let start = selection.start
        let end = selection.end

        for (const attr of attributeRef.current) {
          if (attr.type === DISPLAY_TYPE.MENTION && attr.start < start) {
            start += length
            end += length
          }
        }

        return { start, end }
      },
      [prefixTrigger.mention],
    )

    const dehydrateSelection = useCallback(
      (selection: TextInputSelection): TextInputSelection => {
        const length = prefixTrigger.mention.length
        let start = selection.start
        let end = selection.end

        for (const attr of attributeRef.current) {
          if (
            attr.type === DISPLAY_TYPE.MENTION &&
            attr.start < selection.start
          ) {
            start -= length
            end -= length
          }
        }

        return { start, end }
      },
      [prefixTrigger.mention],
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
          } else if (attribute.type === DISPLAY_TYPE.MENTION) {
            attribute.length += length
            start += length
          }

          output.push(attribute)
        }

        return output
      },
      [prefixTrigger.mention],
    )

    const dehydrateAttributes = useCallback(
      (attributes: Attribute[]): Attribute[] => {
        const output: Attribute[] = []
        let start = 0
        let length = prefixTrigger.mention.length

        for (const attr of attributes) {
          const attribute = { ...attr }
          attribute.start -= start

          if (attribute.type === DISPLAY_TYPE.MENTION) {
            attribute.length -= length
            start += length
          }

          output.push(attribute)
        }

        return output
      },
      [prefixTrigger.mention],
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
          const text = textRef.current

          if (Object.values(prefixTrigger).some((t) => text.includes(t))) {
            const { start } = selectionEvent
            const emojiPosition = text.lastIndexOf(prefixTrigger.emoji, start)
            const mentionPosition = text.lastIndexOf(
              prefixTrigger.mention,
              start,
            )
            const spacePosition = text.indexOf(" ", start)
            const emojiOpen = emojiPosition > spacePosition

            if (
              attributeRef.current.find((attr) => {
                const attrEnd = attr.start + attr.length
                const position = Math.max(emojiPosition, mentionPosition)

                return (
                  EXCLUSIVE_TYPES.includes(attr.type) &&
                  attr.start <= position &&
                  attrEnd >= start
                )
              })
            ) {
              onChangePrefix(null, null)
            } else if (
              emojiPosition >= 0 &&
              emojiOpen &&
              emojiPosition > mentionPosition
            ) {
              const prefix = text.slice(
                emojiPosition + prefixTrigger.emoji.length,
                start,
              )

              if (
                prefix.length >= prefixMaxLength ||
                attributeRef.current.find(
                  (attr) =>
                    attr.type === DISPLAY_TYPE.EMOJI &&
                    attr.start === emojiPosition,
                )
              ) {
                onChangePrefix(null, null)
              } else if (prefix) {
                onChangePrefix(DISPLAY_TYPE.EMOJI, prefix)
              } else {
                onChangePrefix(DISPLAY_TYPE.EMOJI, "")
              }
            } else if (
              mentionPosition >= 0 &&
              mentionPosition > emojiPosition
            ) {
              const prefix = text.slice(
                mentionPosition + prefixTrigger.mention.length,
                start,
              )

              if (
                prefix.length >= prefixMaxLength ||
                attributeRef.current.find(
                  (attr) =>
                    attr.type === DISPLAY_TYPE.MENTION &&
                    attr.start === mentionPosition,
                )
              ) {
                onChangePrefix(null, null)
              } else if (prefix) {
                onChangePrefix(DISPLAY_TYPE.MENTION, prefix)
              } else {
                onChangePrefix(DISPLAY_TYPE.MENTION, "")
              }
            }
          } else {
            onChangePrefix(null, null)
          }
        }
      },
      [
        dehydrateSelection,
        onChangePrefix,
        onSelectionChangeProp,
        prefixMaxLength,
        prefixTrigger,
      ],
    )

    const emitAttributes = useCallback(
      (attributes: Attribute[], current: Attribute | null = null) => {
        console.log("07 EMIT ATTRIBUTES", JSON.stringify(attributes, null, 2))

        const dehydrated = dehydrateAttributes(attributes)

        attributeRef.current = attributes
        currentAttributeRef.current = current
        emittedAttributesRef.current = dehydrated
        eventCount.current.attributes++

        if (typeof onChangeAttributes === "function") {
          onChangeAttributes(dehydrated)
        }
      },
      [dehydrateAttributes, onChangeAttributes],
    )

    const calculateTypingAttributesWorker = useCallback(
      (selection: TextInputSelection) => {
        "worklet"
        console.log(
          "09 TYPING ATTRIBUTES",
          JSON.stringify(
            {
              types: typingAttributes.value,
              selection,
              value,
              prev: sharedText.value,
            },
            null,
            2,
          ),
        )

        const { start, end } = selection
        const types = new Set<DISPLAY_TYPE>()

        if (start === end) {
          for (const attr of appliedAttributes.value) {
            const attrEnd = attr.start + attr.length
            console.log(JSON.stringify({ ...attr, attrEnd }, null, 2))

            if (BLOCK_TYPES.includes(attr.type)) {
              if (value === sharedText.value) {
                if (
                  sharedText.value.charAt(end - 1) === "\n" &&
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
            } else if (value === sharedText.value) {
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
          (type) => !NEVER_TYPES.includes(type),
        )

        if (typeof onChangeTypingAttributes === "function") {
          runOnJS(onChangeTypingAttributes)([...types])
        }
      },
      [onChangeTypingAttributes, selection, value],
    )

    const resetWorker = useCallback(
      (
        value?: string,
        selection?: TextInputSelection,
        attributes?: Attribute[],
      ) => {
        "worklet"
        console.log(
          "?X RESET",
          JSON.stringify({ value, selection, attributes }, null, 2),
        )

        sharedText.value = value ?? ""
        sharedSelection.value = selection ?? { start: 0, end: 0 }
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
      console.log(
        "?? RESET",
        JSON.stringify(
          { eventCount: eventCount.current, propCount: propCount.current },
          null,
          2,
        ),
      )

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
        propCount.current.attributes = attributesCount
        propCount.current.selection = selectionCount
        propCount.current.value = valueCount

        const nextValue =
          valueProp != null ? hydrateValue(valueProp) : textRef.current
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
        const nextAttributes =
          attributesProp != null
            ? hydrateAttributes(attributesProp)
            : attributeRef.current

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
      setValue,
      valueProp,
    ])

    const reset = useCallback(() => {
      setValue("")
      setSelection({ start: 0, end: 0 })
      runOnRuntime(getWorkletRuntime(), resetWorker)()
    }, [resetWorker, setValue])

    const formatCodeBlockWorker = useCallback((type: DISPLAY_TYPE) => {
      "worklet"

      const text = sharedText.value
      const { start, end } = sharedSelection.value
      const types = new Set(typingAttributes.value)
      const prevNewLine = text.lastIndexOf("\n", Math.max(0, start - 1))
      const nextNewLine = text.indexOf("\n", end)
      const lineStart = Math.max(0, prevNewLine)
      const lineEnd = nextNewLine > 0 ? nextNewLine + 1 : text.length
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
    }, [])

    const formatSelection = useCallback(
      (type: DISPLAY_TYPE, content: string | null = null) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, content: string | null) => {
            "worklet"
            console.log("XX FORMAT SELECTION")

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

            if (typeof onChangeTypingAttributes === "function") {
              runOnJS(onChangeTypingAttributes)(typingAttributes.value)
            }
          },
        )(type, content)
      },
      [
        calculateTypingAttributesWorker,
        formatCodeBlockWorker,
        onChangeTypingAttributes,
        selection,
      ],
    )

    const complete = useCallback(
      (type: DISPLAY_TYPE, text: string, content: string | null = null) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, text: string, content: string | null) => {
            "worklet"
            console.log("XX COMPLETE")

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
              prefix +
              text +
              (appendSpace ? " " : "") +
              value.slice(start)
            const nextPosition = position + prefix.length + text.length + 1
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
              length: prefix.length + text.length,
            })

            sharedText.value = nextValue
            sharedSelection.value = nextSelection
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
        console.log(
          "03 SELECTION EVENT",
          JSON.stringify(e.nativeEvent, null, 2),
        )

        const selection = { ...e.nativeEvent.selection }
        const attribute = attributeRef.current.find((attr) => {
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

        setSelection(selection)
        runOnRuntime(
          getWorkletRuntime(),
          calculateTypingAttributesWorker,
        )(selection)
        emitSelection({ ...e, nativeEvent: { ...e.nativeEvent, selection } })
      },
      [calculateTypingAttributesWorker, , emitSelection],
    )

    const onChangeWorker = useCallback(
      (text: string) => {
        "worklet"
        console.log("06 CHANGE WORKER", { text, value })

        const prevAttributes = appliedAttributes.value
        const nextAttributes: Attribute[] = []
        const { start, end } = selection
        const types = new Set(typingAttributes.value)
        const length = text.length - value.length
        const next = text.slice(end, end + length)
        let currentAttr: Attribute | null = null
        console.log(
          JSON.stringify({ start, end, length, types: [...types] }, null, 2),
        )

        for (const attr of prevAttributes) {
          const attrEnd = attr.start + attr.length
          console.log(JSON.stringify({ ...attr, attrEnd }, null, 2))

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
            if (NEVER_TYPES.includes(attr.type)) {
              currentAttr = { ...attr }
            }

            attr.length += length
          } else if (attr.start >= start) {
            if (NEVER_TYPES.includes(attr.type)) {
              currentAttr = { ...attr }
              continue
            }

            attr.start += length
          }

          if (attrEnd > text.length && text.length - attrEnd >= length) {
            if (NEVER_TYPES.includes(attr.type)) {
              currentAttr = { ...attr }
            }

            attr.length = text.length - attr.start
          }

          if (attr.start < 0 || attr.length <= 0) {
            continue
          }

          const prevAttr = nextAttributes.find((prev) => {
            const prevEnd = prev.start + prev.length

            return attr.type === prev.type && attr.start <= prevEnd
          })

          if (prevAttr) {
            prevAttr.length +=
              prevAttr.start + prevAttr.length - attr.start + attr.length
            continue
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

        sharedText.value = text
        appliedAttributes.value = nextAttributes.sort(
          (a, b) => a.start - b.start,
        )

        runOnJS(emitAttributes)(nextAttributes, currentAttr)
      },
      [emitAttributes, selection, value],
    )

    const onChange = useCallback(
      (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        console.log("02 CHANGE EVENT", JSON.stringify(e.nativeEvent, null, 2))

        const prev = textRef.current
        const attribute = currentAttributeRef.current
        let text = e.nativeEvent.text
        const length = text.length - prev.length

        if (length === attribute?.length) {
          currentAttributeRef.current = null
          return
        }

        if (length < 0 && attribute) {
          const attrEnd = attribute.start + attribute.length
          text = prev.slice(0, attribute.start) + prev.slice(attrEnd + 1)
        } else {
          currentAttributeRef.current = null
        }

        runOnRuntime(getWorkletRuntime(), onChangeWorker)(text)
        setValue(text)
        emitValue({ ...e, nativeEvent: { ...e.nativeEvent, text } })
      },
      [emitValue, onChangeWorker, setValue],
    )

    const parser = useCallback(
      (text: string): MarkdownRange[] => {
        "worklet"
        console.log("01 PARSER")

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
  RichTextInputProps,
  RichTextInputRef,
  TextInputSelection,
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
