import React, { useCallback, useRef, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  type TextInputSelectionChangeEventData,
  View,
} from "react-native"
import RichTextInput, {
  type Attribute,
  DISPLAY_TYPE,
  MENTION_TYPE,
  type TextInputSelection,
} from "react-native-live-rich-text"

const MemberList = [
  { name: "Admin One", id: "admin1" },
  { name: "Admin Two", id: "admin2" },
  { name: "Admin Three", id: "admin3" },
  { name: "Moderator One", id: "mod1" },
  { name: "Moderator Two", id: "mod2" },
  { name: "Moderator Three", id: "mod3" },
  { name: "Member One", id: "peer1" },
  { name: "Member Two", id: "peer2" },
  { name: "Member Three", id: "peer3" },
]

const Template1 = {
  text: "Hello, Cruel World!",
  attributes: [{ start: 0, length: 5, type: 4, content: null }],
}
const Template2 = {
  text: "Goodbye, Cruel World!",
  attributes: [{ start: 15, length: 5, type: 5, content: null }],
}
const Template3 = {
  text: "Goodbye Hello, World!",
  attributes: [
    { start: 0, length: 7, type: 9, content: null },
    { start: 8, length: 5, type: 4, content: null },
    { start: 15, length: 5, type: 5, content: null },
  ],
}

export default function App() {
  const ref = useRef<RichTextInput>(null)
  const [text, setText] = useState("")
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [selection, setSelection] = useState<TextInputSelection>({
    start: 0,
    end: 0,
  })
  const [format, setFormat] = useState<Set<DISPLAY_TYPE>>(new Set())
  const [autocompleteContent, setAutocompleteContent] = useState<
    typeof MemberList | string[]
  >([])

  const mentionTypeWorklet = useCallback(
    (text: string, content: string | null) => {
      "worklet"

      const index = MemberList.findIndex((member) => member.id === content)

      if (index < 3) {
        return MENTION_TYPE.THREE
      } else if (index < 6) {
        return MENTION_TYPE.TWO
      }
      return MENTION_TYPE.ONE
    },
    [],
  )

  const onChangeText = useCallback((text: string) => {
    console.log("A2 CHANGE TEXT", JSON.stringify({ text }, null, 2))
    setText(text)
  }, [])

  const onChangePrefix = useCallback(
    (type: DISPLAY_TYPE | null, prefix: string | null) => {
      // console.log("A4 CHANGE PREFIX", JSON.stringify({ type, prefix }, null, 2))

      if (typeof prefix === "string") {
        if (type === DISPLAY_TYPE.MENTION) {
          setAutocompleteContent(
            MemberList.filter((member) =>
              member.name.toLowerCase().startsWith(prefix),
            ),
          )
        } else {
          setAutocompleteContent([])
        }
      } else {
        setAutocompleteContent([])
      }
    },
    [],
  )

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      console.log(
        "A3 CHANGE SELECTION",
        JSON.stringify(e.nativeEvent.selection, null, 2),
      )
      setSelection(e.nativeEvent.selection)
    },
    [],
  )

  const onChangeAttributes = useCallback((attrs: Attribute[]) => {
    console.log("A1 CHANGE ATTRIBUTES", JSON.stringify(attrs, null, 2))
    setAttributes(attrs)
  }, [])

  const onChangeTypingAttributes = useCallback(
    (typingAttrs: DISPLAY_TYPE[]) => {
      console.log("AX TYPING ATTRIBUTES", JSON.stringify(typingAttrs, null, 2))
      setFormat(new Set(typingAttrs))
    },
    [],
  )

  const toggleBold = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.BOLD),
    [],
  )

  const toggleItalic = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.ITALIC),
    [],
  )

  const toggleStrikethrough = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.STRIKE_THROUGH),
    [],
  )

  const toggleCode = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.CODE),
    [],
  )

  const toggleCodeBlock = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.CODE_BLOCK),
    [],
  )

  const applyTemplate1 = useCallback(() => {
    setText(Template1.text)
    setAttributes(Template1.attributes)
  }, [])

  const applyTemplate2 = useCallback(() => {
    setText(Template2.text)
    setAttributes(Template2.attributes)
  }, [])

  const applyTemplate3 = useCallback(() => {
    setText(Template3.text)
    setAttributes(Template3.attributes)
  }, [])

  const clear = useCallback(() => {
    ref.current?.reset()
    setText("")
    setAttributes([])
    setFormat(new Set())
  }, [])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<(typeof MemberList)[0] | string>) => {
      if (typeof item === "string") {
        return (
          <Text
            onPress={() =>
              ref.current?.complete(DISPLAY_TYPE.EMOJI, item, item)
            }
          >
            {item}
          </Text>
        )
      } else {
        return (
          <Text
            onPress={() =>
              ref.current?.complete(DISPLAY_TYPE.MENTION, item.name, item.id)
            }
          >
            {item.name}
          </Text>
        )
      }
    },
    [],
  )

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView>
        <View>
          {!!autocompleteContent.length && (
            <FlatList
              data={autocompleteContent}
              renderItem={renderItem}
              style={styles.autocomplete}
              keyboardDismissMode="none"
              keyboardShouldPersistTaps
            />
          )}
          <View style={styles.inputContainer}>
            <RichTextInput
              editable
              multiline
              ref={ref}
              style={styles.input}
              mentionTypeWorklet={mentionTypeWorklet}
              value={text}
              onChangeText={onChangeText}
              selection={selection}
              onSelectionChange={onSelectionChange}
              attributes={attributes}
              onChangeAttributes={onChangeAttributes}
              onChangeTypingAttributes={onChangeTypingAttributes}
              onChangePrefix={onChangePrefix}
            />
            <View style={styles.toolbar}>
              <Pressable
                style={[
                  styles.button,
                  format.has(DISPLAY_TYPE.BOLD) && styles.highlight,
                ]}
                onPress={toggleBold}
              >
                <Text style={[styles.label, styles.bold]}>B</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  format.has(DISPLAY_TYPE.ITALIC) && styles.highlight,
                ]}
                onPress={toggleItalic}
              >
                <Text style={[styles.label, styles.italic]}>I</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  format.has(DISPLAY_TYPE.STRIKE_THROUGH) && styles.highlight,
                ]}
                onPress={toggleStrikethrough}
              >
                <Text style={[styles.label, styles.strike]}>S</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  format.has(DISPLAY_TYPE.CODE) && styles.highlight,
                ]}
                onPress={toggleCode}
              >
                <Text style={styles.label}>{"<>"}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  format.has(DISPLAY_TYPE.CODE_BLOCK) && styles.highlight,
                ]}
                onPress={toggleCodeBlock}
              >
                <Text style={styles.label}>{"</>"}</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={applyTemplate1}>
                <Text style={styles.label}>1</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={applyTemplate2}>
                <Text style={styles.label}>2</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={applyTemplate3}>
                <Text style={styles.label}>3</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={clear}>
                <Text style={styles.label}>X</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  autocomplete: {
    maxHeight: 96,
    borderColor: "#000",
    borderWidth: 1,
    borderRadius: 8,
  },
  bold: {
    fontWeight: "bold",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#efefef",
    borderColor: "#424242",
    borderRadius: 4,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  highlight: {
    backgroundColor: "#cdcdcd",
  },
  input: {
    flex: 1,
  },
  inputContainer: {
    borderColor: "#555",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    height: 96,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  italic: {
    fontStyle: "italic",
  },
  label: {
    fontSize: 20,
  },
  strike: {
    textDecorationLine: "line-through",
  },
  toolbar: {
    flexDirection: "row",
    gap: 8,
  },
})
