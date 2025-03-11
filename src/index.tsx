import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  DISPLAY_TYPE,
  EXCLUSIVE_TYPES,
  type RichTextInputProps,
  type RichTextInputRef,
  type TextInputSelection,
} from "./types"

const RichTextInput = forwardRef<RichTextInputRef, RichTextInputProps>(
  (
    {
      value: valueProp,
      selection: selectionProp,
      attributes: attributesProp,
      attributeStyle,
      prefixMaxLength,
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
    const [forceUpdate, setForceUpdate] = useState(false)

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
      console.log("05 VALUE SETTER")
      setValue(valueProp ?? "")
    }, [valueProp])

    useEffect(() => {
      console.log("06 SELECTION SETTER")
      setSelection({
        start: selectionProp?.start ?? 0,
        end: selectionProp?.end ?? selectionProp?.start ?? 0,
      })
    }, [selectionProp])

    useEffect(() => {
      runOnRuntime(getWorkletRuntime(), (attributes?: Attribute[]) => {
        "worklet"
        console.log("09 ATTRIBUTE SETTER")

        skipUpdate.value = false
        appliedAttributes.value = attributes ?? []
      })(attributesProp)
    }, [attributesProp])

    const calculateTypingAttributesWorker = useCallback(() => {
      "worklet"
      console.log("08 TYPING ATTRIBUTES")

      const { start, end } = sharedSelection.value
      const types = new Set<DISPLAY_TYPE>()

      if (start === end) {
        for (const attr of appliedAttributes.value) {
          const attrEnd = attr.start + attr.length

          if (value === sharedText.value) {
            if (attr.start < start && attrEnd > end) {
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

      typingAttributes.value = [...types]

      if (typeof onChangeTypingAttributes === "function") {
        runOnJS(onChangeTypingAttributes)([...types])
      }
    }, [onChangeTypingAttributes, value])

    const resetWorker = useCallback(
      (value?: string, attributes?: Attribute[]) => {
        "worklet"
        console.log("?X RESET")

        sharedText.value = value ?? ""
        sharedSelection.value = { start: 0, end: 0 }
        appliedAttributes.value = attributes ?? []
        typingAttributes.value = []
      },
      [],
    )

    const reset = useCallback(() => {
      setValue("")
      setSelection({ start: 0, end: 0 })
      runOnRuntime(getWorkletRuntime(), resetWorker)()
    }, [resetWorker])

    const formatSelection = useCallback(
      (type: DISPLAY_TYPE, content: string | null = null) => {
        runOnRuntime(
          getWorkletRuntime(),
          (type: DISPLAY_TYPE, content: string | null) => {
            "worklet"
            console.log("XX FORMAT SELECTION")

            const { start, end } = sharedSelection.value

            if (start === end) {
              const types = new Set(typingAttributes.value)

              if (EXCLUSIVE_TYPES.includes(type)) {
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

              calculateTypingAttributesWorker()

              runOnJS(setForceUpdate)((u) => !u)
            }

            if (typeof onChangeTypingAttributes === "function") {
              runOnJS(onChangeTypingAttributes)(typingAttributes.value)
            }
          },
        )(type, content)
      },
      [calculateTypingAttributesWorker, onChangeTypingAttributes],
    )

    const complete = useCallback(
      (type: DISPLAY_TYPE, text: string, content: string | null = null) => {
        console.log("XX COMPLETE", { type, text, content })
      },
      [],
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
        console.log("07 SELECTION WORKER")

        sharedSelection.value = selection

        calculateTypingAttributesWorker()
      },
      [calculateTypingAttributesWorker],
    )

    const onSelectionChange = useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        console.log("04 SELECTION EVENT")
        runOnRuntime(
          getWorkletRuntime(),
          onSelectionChangeWorker,
        )(e.nativeEvent.selection)
        setSelection(e.nativeEvent.selection)

        if (typeof onSelectionChangeProp === "function") {
          onSelectionChangeProp(e)
        }
      },
      [onSelectionChangeProp, onSelectionChangeWorker],
    )

    const onChangeText = useCallback(
      (e: string) => {
        console.log("03 CHANGE TEXT EVENT")
        if (typeof onChangeTextProp === "function") {
          onChangeTextProp(e)
        }
      },
      [onChangeTextProp],
    )

    const onChange = useCallback(
      (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        console.log("02 CHANGE EVENT")

        setValue(e.nativeEvent.text)

        if (typeof onChangeProp === "function") {
          onChangeProp(e)
        }
      },
      [onChangeProp],
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

          for (const attr of appliedAttributes.value) {
            const attrEnd = attr.start + attr.length

            if (types.has(attr.type) && attr.start <= start && attrEnd >= end) {
              types.delete(attr.type)
              attr.length += length
            } else if (attr.start >= start) {
              attr.start += length
            }

            if (attrEnd > text.length) {
              attr.length = text.length - attr.start
            }

            attributes.push(attr)
          }

          if (length > 0) {
            for (const type of types) {
              attributes.push({
                type,
                content: null,
                start,
                length,
              })
            }
          }

          sharedText.value = text
          appliedAttributes.value = attributes.sort((a, b) => a.start - b.start)

          if (typeof onChangeAttributes === "function") {
            skipUpdate.value = true
            runOnJS(onChangeAttributes)(attributes)
          }
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
        markdownStyle={attributeStyle}
        parser={parser}
        value={value}
        onChange={onChange}
        onChangeText={onChangeText}
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
  RichTextInputProps,
  RichTextInputRef,
  TextInputSelection,
}
