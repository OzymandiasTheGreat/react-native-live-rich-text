import React, {
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
  MarkdownTextInput,
  type MarkdownType,
} from "@expensify/react-native-live-markdown"
import {
  type Attribute,
  BLOCK_TYPES,
  DEFAULT_PREFIX,
  DISPLAY_TYPE,
  EXCLUSIVE_TYPES,
  NEVER_TYPES,
  type PrefixTrigger,
  type RichTextInputProps,
  type RichTextInputRef,
  type TextInputSelection,
} from "./types"
import { remapAttributeStyles } from "./utils"

const RichTextInput = forwardRef<RichTextInputRef, RichTextInputProps>(
  (
    {
      value: valueProp,
      selection: selectionProp,
      attributes: attributesProp,
      attributeStyle,
      prefixMaxLength = 255,
      prefixTrigger = DEFAULT_PREFIX,
      onChange: onChangeProp,
      onChangeText: onChangeTextProp,
      onSelectionChange: onSelectionChangeProp,
      onChangeAttributes: onChangeAttributesProp,
      onChangeTypingAttributes,
      onChangePrefix,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<MarkdownTextInput>(null)
    const textRef = useRef("")
    const attributeRef = useRef<Attribute[]>([])
    const currentAttributeRef = useRef<Attribute | null>(null)
    const [forceUpdate, setForceUpdate] = useState(false)
    const markdownStyle = useMemo(
      () => remapAttributeStyles(attributeStyle ?? {}),
      [attributeStyle],
    )

    const [value, setValue] = useState("")
    const [selection, setSelection] = useState<TextInputSelection>({
      start: 0,
      end: 0,
    })

    const skipUpdate = useSharedValue(false)
    const sharedText = useSharedValue("")
    const sharedSelection = useSharedValue<TextInputSelection>({
      start: 0,
      end: 0,
    })
    const appliedAttributes = useSharedValue<Attribute[]>([])
    const typingAttributes = useSharedValue<DISPLAY_TYPE[]>([])

    useEffect(() => {
      console.log("06 VALUE SETTER")
      setValue(valueProp ?? "")
    }, [valueProp])

    useEffect(() => {
      console.log("07 SELECTION SETTER")
      setSelection({
        start: selectionProp?.start ?? 0,
        end: selectionProp?.end ?? selectionProp?.start ?? 0,
      })
    }, [selectionProp])

    useEffect(() => {
      runOnRuntime(getWorkletRuntime(), (attributes?: Attribute[]) => {
        "worklet"
        console.log("10 ATTRIBUTE SETTER")

        skipUpdate.value = false
        appliedAttributes.value = attributes ?? []
      })(attributesProp)
    }, [attributesProp])

    const updateValue = useCallback((value: string) => {
      textRef.current = value
      setValue(value)
    }, [])

    const onChangeAttributes = useCallback(
      (attributes: Attribute[], current: Attribute | null = null) => {
        console.log("02 CHANGE ATTRIBUTES", attributes)

        attributeRef.current = attributes
        currentAttributeRef.current = current ?? null

        if (typeof onChangeAttributesProp === "function") {
          onChangeAttributesProp(attributes)
        }
      },
      [onChangeAttributesProp],
    )

    const calculateTypingAttributesWorker = useCallback(() => {
      "worklet"
      console.log("09 TYPING ATTRIBUTES")

      const { start, end } = sharedSelection.value
      const types = new Set<DISPLAY_TYPE>()

      if (start === end) {
        for (const attr of appliedAttributes.value) {
          const attrEnd = attr.start + attr.length

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
            if (attr.start < start && attrEnd > end) {
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
    }, [onChangeTypingAttributes, value])

    const resetWorker = useCallback(
      (value?: string, attributes?: Attribute[]) => {
        "worklet"
        console.log("?X RESET")

        sharedText.value = value ?? ""
        sharedSelection.value = selection
        appliedAttributes.value = attributes ?? []
        typingAttributes.value = []

        calculateTypingAttributesWorker()
      },
      [selection],
    )

    const reset = useCallback(() => {
      updateValue("")
      setSelection({ start: 0, end: 0 })
      runOnRuntime(getWorkletRuntime(), resetWorker)()
    }, [resetWorker, updateValue])

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

            const { start, end } = sharedSelection.value
            const text = sharedText.value

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

              calculateTypingAttributesWorker()
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
      ],
    )

    const complete = useCallback(
      (type: DISPLAY_TYPE, text: string, content: string | null = null) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, text: string, content: string | null) => {
            "worklet"
            console.log("XX COMPLETE")

            const { start } = sharedSelection.value
            const value = sharedText.value
            const appendSpace = !/\s/.test(value.charAt(start))
            let position: number
            let prefix: string

            switch (type) {
              case DISPLAY_TYPE.EMOJI: {
                position = value.lastIndexOf(prefixTrigger.emoji, start)
                prefix = prefixTrigger.emoji
                break
              }
              case DISPLAY_TYPE.MENTION: {
                position = value.lastIndexOf(prefixTrigger.mention, start)
                prefix = prefixTrigger.mention
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
                  const prev = {
                    ...attr,
                    length: attrEnd - position,
                  }
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
                  attr.start = position + prefix.length + text.length

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

            calculateTypingAttributesWorker()

            runOnJS(updateValue)(nextValue)
            runOnJS(setSelection)(nextSelection)
            runOnJS(onChangeAttributes)(attributes)

            if (typeof onChangeProp === "function") {
              runOnJS(onChangeProp)({
                nativeEvent: { text: nextValue, target: -1, eventCount: -1 },
              } as NativeSyntheticEvent<TextInputChangeEventData>)
            }

            if (typeof onChangeTextProp === "function") {
              runOnJS(onChangeTextProp)(nextValue)
            }

            if (typeof onSelectionChangeProp === "function") {
              runOnJS(onSelectionChangeProp)({
                nativeEvent: { selection: nextSelection, target: -1 },
              } as NativeSyntheticEvent<TextInputSelectionChangeEventData>)
            }

            if (typeof onChangePrefix === "function") {
              runOnJS(onChangePrefix)(null, null)
            }
          },
        )(type, text, content)
      },
      [
        calculateTypingAttributesWorker,
        onChangeAttributes,
        onChangePrefix,
        onChangeProp,
        onChangeTextProp,
        onSelectionChangeProp,
        prefixTrigger,
        prefixMaxLength,
        updateValue,
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
      [complete, formatSelection],
    )

    useEffect(() => {
      if (value !== valueProp) {
        // Props changed externally, reset state
        runOnRuntime(getWorkletRuntime(), resetWorker)(
          valueProp,
          attributesProp,
        )
      }
    }, [attributesProp, resetWorker, value, valueProp])

    const onSelectionChangeWorker = useCallback(
      (selection: TextInputSelection) => {
        "worklet"
        console.log("08 SELECTION WORKER")

        sharedSelection.value = selection

        calculateTypingAttributesWorker()
      },
      [calculateTypingAttributesWorker],
    )

    const onSelectionChange = useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        console.log("05 SELECTION EVENT")

        const text = textRef.current
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

        if (attribute) {
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

        runOnRuntime(getWorkletRuntime(), onSelectionChangeWorker)(selection)
        setSelection(selection)

        if (typeof onSelectionChangeProp === "function") {
          onSelectionChangeProp({
            ...e,
            nativeEvent: { ...e.nativeEvent, selection },
          })
        }

        if (typeof onChangePrefix === "function") {
          if (Object.values(prefixTrigger).some((t) => text.includes(t))) {
            const { start } = selection
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
        onChangePrefix,
        onSelectionChangeProp,
        onSelectionChangeWorker,
        prefixMaxLength,
        prefixTrigger,
      ],
    )

    const onChange = useCallback(
      (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        console.log("03 CHANGE EVENT")

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
        updateValue(text)

        if (typeof onChangeProp === "function") {
          onChangeProp({ ...e, nativeEvent: { ...e.nativeEvent, text } })
        }

        if (typeof onChangeTextProp === "function") {
          onChangeTextProp(text)
        }
      },
      [onChangeProp, onChangeTextProp, updateValue],
    )

    const parser = useCallback(
      (text: string): MarkdownRange[] => {
        "worklet"

        const attributes: Attribute[] = []

        if (!skipUpdate.value && sharedText.value !== text) {
          console.log("01 PROCESSOR")

          if (sharedSelection.value.end > sharedText.value.length) {
            sharedSelection.value.start = sharedText.value.length
            sharedSelection.value.end = sharedText.value.length
          }

          const { start, end } = sharedSelection.value
          const types = new Set(typingAttributes.value)
          const length = text.length - sharedText.value.length
          const next = text.slice(end, end + length)
          let currentAttr: Attribute | null = null

          for (const attr of appliedAttributes.value) {
            const attrEnd = attr.start + attr.length

            if (types.has(attr.type) && attr.start <= start && attrEnd >= end) {
              types.delete(attr.type)

              if (attr.type === DISPLAY_TYPE.CODE) {
                if (!next.startsWith("\n")) {
                  if (next.includes("\n")) {
                    attr.length += next.indexOf("\n")
                  } else {
                    attr.length += next.length
                  }
                }
              } else {
                attr.length += length
              }
            } else if (
              !types.has(attr.type) &&
              attrEnd === start &&
              length < 0
            ) {
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

            if (attrEnd > text.length) {
              if (NEVER_TYPES.includes(attr.type)) {
                currentAttr = { ...attr }
              }

              attr.length = text.length - attr.start
            }

            if (attr.start < 0 || attr.length <= 0) {
              continue
            }

            const prevAttr = attributes.find((prev) => {
              const prevEnd = prev.start + prev.length

              return attr.type === prev.type && attr.start <= prevEnd
            })

            if (prevAttr) {
              prevAttr.length +=
                prevAttr.start + prevAttr.length - attr.start + attr.length
              continue
            }

            attributes.push(attr)
          }

          if (length > 0) {
            for (const type of types) {
              if (type === DISPLAY_TYPE.CODE) {
                attributes.push({
                  type,
                  content: null,
                  start,
                  length: next.indexOf("\n"),
                })
              } else {
                attributes.push({
                  type,
                  content: null,
                  start,
                  length,
                })
              }
            }
          }

          sharedText.value = text
          appliedAttributes.value = attributes.sort((a, b) => a.start - b.start)
          skipUpdate.value = true

          runOnJS(onChangeAttributes)(attributes, currentAttr)
        } else {
          console.log("01 PARSER")

          attributes.push(...appliedAttributes.value)
        }

        const ranges: MarkdownRange[] = []

        for (const attr of attributes) {
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
              type = "mention-user"
              break
            default:
              console.error("Unknown Display type")
              continue
          }

          ranges.push({ type, start, length })
        }

        return ranges
      },
      [forceUpdate, onChangeAttributes],
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

export { DISPLAY_TYPE }

export type {
  Attribute,
  PrefixTrigger,
  RichTextInputProps,
  RichTextInputRef,
  TextInputSelection,
}
