import React, { useCallback, useRef, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInputSelectionChangeEventData,
  View,
} from "react-native"
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context"
import MDI from "@expo/vector-icons/MaterialCommunityIcons"
import EmojiData from "emoji-datasource/emoji.json"
import {
  toEmoji as toEmojiOrig,
  toShortCode as toShortCodeOrig,
  // @ts-ignore
} from "emoji-index"
import RichTextInput, {
  type Attribute,
  type AttributeStyle,
  DISPLAY_TYPE,
  MENTION_TYPE,
  type Protocol,
  type TextInputSelection,
} from "react-native-live-rich-text"

const BACKGROUND_COLOR = "#fafafa"
const INPUT_COLOR = "#fff"
const BUTTON_COLOR = "#e0e0e0"
const TEXT_COLOR = "#212121"
const PREVIEW_COLOR = "#424242"
const CODE_BACKGROUND = "#9e9e9e"
const CODE_COLOR = "#fbc02d"
const CODE_SIZE = 14
const FONT_SIZE = 16
const ICON_SIZE = 24
const MAX_AUTOCOMPLETE_ITEMS = 12

const Protocols: Protocol[] = [{ scheme: "pear", optionalSlashSlash: false }]

const AttributeStyle: AttributeStyle = {
  code: {
    backgroundColor: CODE_BACKGROUND,
    color: CODE_COLOR,
    fontSize: CODE_SIZE,
  },
  codeBlock: {
    backgroundColor: CODE_BACKGROUND,
    fontSize: CODE_SIZE,
  },
  emoji: {
    fontSize: FONT_SIZE,
  },
  mentionOne: {
    backgroundColor: "#26D2E820",
    borderRadius: 4,
    color: "#26D2E8",
  },
  mentionTwo: {
    backgroundColor: "#F47AFA20",
    borderRadius: 4,
    color: "#F47AFA",
  },
  mentionThree: {
    backgroundColor: "#53EA9820",
    borderRadius: 4,
    color: "#53EA98",
  },
}

type Member = { name: string; id: string }

const MemberList: Member[] = [
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

type Emoji = { shortCode: string; emoji: string }

const Emojis: Emoji[] = [
  ...EmojiData.map((e) => ({
    shortCode: e.short_name,
    emoji: toEmojiOrig(e.short_name),
  })),
  { shortCode: "keet", emoji: ":keet:" },
  { shortCode: "keet-yay", emoji: ":keet-yay:" },
  { shortCode: "keetsanta", emoji: ":keetsanta:" },
].sort((a, b) => a.shortCode.localeCompare(b.shortCode))

function toEmoji(shortCode: string): string {
  let emoji = toEmojiOrig(shortCode)

  if (emoji) {
    return emoji
  }

  emoji = Emojis.find((e) => e.shortCode === shortCode)?.emoji

  return emoji ?? ""
}

function toShortCode(emoji: string): string {
  let shortCode = toShortCodeOrig(emoji)

  if (shortCode) {
    return shortCode
  }

  shortCode = Emojis.find((e) => e.emoji === emoji)?.shortCode

  return shortCode ?? ""
}

function App() {
  const ref = useRef<RichTextInput>(null)
  const [text, setText] = useState("")
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [selection, setSelection] = useState<TextInputSelection>({
    start: 0,
    end: 0,
  })
  const [format, setFormat] = useState<Set<DISPLAY_TYPE>>(new Set())
  const [autocompleteContent, setAutocompleteContent] = useState<
    Member[] | Emoji[]
  >([])
  const [autocompleteOffset, setAutocompleteOffset] = useState(0)
  const { top } = useSafeAreaInsets()

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
    setText(text)
  }, [])

  const onChangePrefix = useCallback(
    (type: DISPLAY_TYPE | null, prefix: string | null) => {
      if (typeof prefix === "string") {
        if (type === DISPLAY_TYPE.MENTION) {
          setAutocompleteContent(
            MemberList.filter((member) =>
              member.name
                .toLowerCase()
                .startsWith(
                  prefix.toLowerCase().slice(0, MAX_AUTOCOMPLETE_ITEMS),
                ),
            ),
          )
        } else if (type === DISPLAY_TYPE.EMOJI) {
          setAutocompleteContent(
            Emojis.filter((emoji) => emoji.shortCode.startsWith(prefix)).slice(
              0,
              MAX_AUTOCOMPLETE_ITEMS,
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
      setSelection(e.nativeEvent.selection)
    },
    [],
  )

  const onChangeAttributes = useCallback((attrs: Attribute[]) => {
    setAttributes(attrs)
  }, [])

  const onChangeTypingAttributes = useCallback(
    (typingAttrs: DISPLAY_TYPE[]) => {
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

  const toggleCodeBlock = useCallback(
    () => ref.current?.formatSelection(DISPLAY_TYPE.CODE_BLOCK),
    [],
  )

  const renderAttributeItem = useCallback(
    ({ item }: ListRenderItemInfo<Attribute>) => {
      return <Text style={styles.preview}>{JSON.stringify(item, null, 2)}</Text>
    },
    [],
  )

  const renderAutocompleteItem = useCallback(
    ({ item }: ListRenderItemInfo<Member | Emoji>) => {
      if ("shortCode" in item) {
        return (
          <Pressable
            style={styles.autocompleteItem}
            onPress={() =>
              ref.current?.complete(
                DISPLAY_TYPE.EMOJI,
                item.emoji,
                item.shortCode,
              )
            }
          >
            <Text style={styles.autocompletePreview}>{item.emoji}</Text>
            <Text style={styles.autocompleteText}>:{item.shortCode}:</Text>
          </Pressable>
        )
      } else {
        return (
          <Pressable
            style={styles.autocompleteItem}
            onPress={() =>
              ref.current?.complete(DISPLAY_TYPE.MENTION, item.name, item.id)
            }
          >
            <Text style={styles.autocompleteText}>{item.name}</Text>
          </Pressable>
        )
      }
    },
    [],
  )

  const onAutocompleteLayout = useCallback(
    (e: LayoutChangeEvent) =>
      setAutocompleteOffset(e.nativeEvent.layout.height),
    [],
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.valuePreview, { marginTop: top }]}>
        <ScrollView>
          <Text style={styles.preview}>{text}</Text>
        </ScrollView>
      </View>
      <View style={styles.attributePreview}>
        <FlatList
          data={attributes}
          renderItem={renderAttributeItem}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={-24}
      >
        <View style={styles.inputContainer}>
          <RichTextInput
            ref={ref}
            multiline
            placeholder="Enter text here..."
            attributeStyle={AttributeStyle}
            customLinkProtocols={Protocols}
            value={text}
            onChangeText={onChangeText}
            selection={selection}
            onSelectionChange={onSelectionChange}
            attributes={attributes}
            onChangeAttributes={onChangeAttributes}
            onChangeTypingAttributes={onChangeTypingAttributes}
            onChangePrefix={onChangePrefix}
            mentionTypeWorklet={mentionTypeWorklet}
            toEmoji={toEmoji}
            toShortCode={toShortCode}
            style={styles.input}
          />
          <View style={styles.toolbar}>
            <Pressable
              onPress={toggleBold}
              style={[
                styles.button,
                format.has(DISPLAY_TYPE.BOLD) && styles.highlight,
              ]}
            >
              <MDI name="format-bold" color={TEXT_COLOR} size={ICON_SIZE} />
            </Pressable>
            <Pressable
              onPress={toggleItalic}
              style={[
                styles.button,
                format.has(DISPLAY_TYPE.ITALIC) && styles.highlight,
              ]}
            >
              <MDI name="format-italic" color={TEXT_COLOR} size={ICON_SIZE} />
            </Pressable>
            <Pressable
              onPress={toggleStrikethrough}
              style={[
                styles.button,
                format.has(DISPLAY_TYPE.STRIKE_THROUGH) && styles.highlight,
              ]}
            >
              <MDI
                name="format-strikethrough"
                color={TEXT_COLOR}
                size={ICON_SIZE}
              />
            </Pressable>
            <Pressable
              onPress={toggleCodeBlock}
              style={[
                styles.button,
                format.has(DISPLAY_TYPE.CODE_BLOCK) && styles.highlight,
              ]}
            >
              <MDI name="code-braces" color={TEXT_COLOR} size={ICON_SIZE} />
            </Pressable>
          </View>
        </View>
        {!!autocompleteContent.length && (
          <View
            style={[styles.autocomplete, { top: -(autocompleteOffset - 8) }]}
            onLayout={onAutocompleteLayout}
          >
            <FlatList
              data={autocompleteContent}
              renderItem={renderAutocompleteItem}
              keyboardDismissMode="none"
              keyboardShouldPersistTaps="always"
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default function () {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  attributePreview: {
    borderBottomColor: PREVIEW_COLOR,
    borderBottomWidth: 1,
    flex: 1,
  },
  autocomplete: {
    backgroundColor: INPUT_COLOR,
    borderColor: TEXT_COLOR,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  autocompleteItem: {
    alignItems: "center",
    flexDirection: "row",
  },
  autocompletePreview: {
    fontSize: ICON_SIZE,
    marginEnd: 8,
  },
  autocompleteText: {
    color: TEXT_COLOR,
    fontSize: FONT_SIZE,
  },
  button: {
    backgroundColor: INPUT_COLOR,
    borderRadius: 8,
    height: 24,
    width: 24,
  },
  container: {
    backgroundColor: BACKGROUND_COLOR,
    flex: 1,
    paddingHorizontal: 16,
  },
  highlight: {
    backgroundColor: BUTTON_COLOR,
  },
  input: {
    color: TEXT_COLOR,
    fontSize: FONT_SIZE,
  },
  inputContainer: {
    backgroundColor: INPUT_COLOR,
    borderColor: TEXT_COLOR,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  preview: {
    color: PREVIEW_COLOR,
    fontSize: FONT_SIZE,
  },
  section: {
    borderBottomColor: TEXT_COLOR,
    borderBottomWidth: 1,
  },
  toolbar: {
    flexDirection: "row",
    gap: 8,
  },
  valuePreview: {
    borderBottomColor: PREVIEW_COLOR,
    borderBottomWidth: 1,
    height: 64,
  },
})
