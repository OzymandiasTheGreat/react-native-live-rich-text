import React, { type ElementRef, useCallback, useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInputSelectionChangeEventData,
  View,
} from "react-native"
import RichTextInput, {
  type Attribute,
  DISPLAY_TYPE,
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
  const ref = useRef<ElementRef<typeof RichTextInput>>(null)
  const [text, setText] = useState("")
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [selection, setSelection] = useState<TextInputSelection>({
    start: 0,
    end: 0,
  })
  const [format, setFormat] = useState<Set<DISPLAY_TYPE>>(new Set())

  const onChangeText = useCallback((text: string) => {
    console.log("A1 CHANGE TEXT", text)
    setText(text)
  }, [])

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      console.log("A2 CHANGE SELECTION", e.nativeEvent.selection)
      setSelection(e.nativeEvent.selection)
    },
    [],
  )

  const onChangeAttributes = useCallback((attrs: Attribute[]) => {
    console.log("A3 CHANGE ATTRIBUTES", attrs)
    setAttributes(attrs)
  }, [])

  const onChangeTypingAttributes = useCallback(
    (typingAttrs: DISPLAY_TYPE[]) => {
      console.log("A4 TYPING ATTRIBUTES", typingAttrs)
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
    setText("")
    setAttributes([])
    setFormat(new Set())
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView>
        <View style={styles.inputContainer}>
          <RichTextInput
            editable
            multiline
            ref={ref}
            style={styles.input}
            value={text}
            onChangeText={onChangeText}
            selection={selection}
            onSelectionChange={onSelectionChange}
            attributes={attributes}
            onChangeAttributes={onChangeAttributes}
            onChangeTypingAttributes={onChangeTypingAttributes}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
    width: "80%",
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
