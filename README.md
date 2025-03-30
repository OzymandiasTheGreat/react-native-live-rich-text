# react-native-live-rich-text

Native/javascript WYSIWYG rich text editor for `react-native` that also functions as drop-in replacement for `TextInput`.
Formatted text is rendered natively within the input by `@expensify/react-native-live-markdown` while editor state and logic
is managed with javascript in worker thread thanks to `react-native-reanimated`. The editor is completely headless, you can
specify your own styles for text, and build any kind of UI around it.

## Usage

```typescript
import React, { useRef, useState } from "react"
import { Pressable, SafeAreaView } from "react-native"
import RichTextInput, { type Attribute, DISPLAY_TYPE } from "react-native-live-rich-text"

export default function App() {
  const ref = useRef<RichTextInput>(null)
  const [value, setValue] = useState("")
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [format, setFormat] = useState<DISPLAY_TYPE[]>([])

  return (
    <SafeAreaView>
      <RichTextInput
        ref={ref}
        value={value}
        onChangeText={setValue}
        selection={selection}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        attributes={attributes}
        onChangeAttributes={setAttributes}
        onChangeTypingAttributes={setFormat}
      />
      <Pressable
        style={format.includes(DISPLAY_TYPE.BOLD) && { backgroundColor: "#f00" }}
        onPress={() => ref.current?.formatSelection(DISPLAY_TYPE.BOLD)}
      >
        <Icon name="format-bold">
      </Pressable>
    </SafeAreaView>
  )
}
```

### API

#### `RichTextInput` props

All props are the same as `react-native`'s `TextInput` with a few additions below. All additional props
are optional.

##### `attributes?: Attribute[]`

Pass in initial attributes to apply to `value`. It's callers responsibility to make sure attributes match passed-in
value, attributes that go beyond value range will be silently dropped.

##### `attributeStyle?: AttributeStyle`

Custom styles for formatted ranges.

##### `customLinkProtocols?: Protocol[]`

Custom protocols/uri schemes to be recognized within input. By default only http links are recognized.
For more information see [linkifyjs documentation](https://linkify.js.org/docs/linkifyjs.html#linkifyregistercustomprotocol-scheme--optionalslashslash--false).

##### `prefixMaxLength?: number`

Prefixes longer than this will not be emitted.

##### `prefixTrigger?: PrefixTrigger`

Specify custom prefixes for mentions and emojis.

##### `mentionTypeWorklet?: (text: string, content: string | null) => MENTION_TYPE`

> NOTE: This runs in a separate thread, so you have to specify "worklet" at the very top of this function

Callback that returns the type of mention. Three distinct types of mention are supported,
as for their meaning it's up to implementer.

##### `toEmoji?: (shortCode: string) => string`

A function that takes string shortCode and returns emoji. If shortCode is invalid it should return empty string.
Only needed when implementing support for custom emojis.

##### `toShortCode?: (emoji: string) => string`

A function that takes string emoji and returns a shortCode for it. If emoji is invalide it should return empty string.
Only needed when implementing support for custom emojis.

##### `onChangeAttributes?: (attributes: Attribute[]) => void`

Callback that's invoked whenever editor state changes with current attributes of the input text.

##### `onChangeTypingAttributes?: (typingAttributes: DISPLAY_TYPE[]) => void`

Callback that's invoked whenever typing attributes change.
Typing attributes are attributes that are applied while typing. You can toggle them with `ref.formatSelection(...)`

##### `onChangePrefix?: (type: PrefixType, prefix: string | null) => void`

Callback that's invoked while typing after trigger character. Use when implementing autocomplete.

#### `RichTextInput` methods

##### `reset: () => void`

Should not be used unless bugs. Resets editor state.

##### `formatSelection: (type: ManualType, content?: string | null) => void`

Toggle typing attributes while typing or toggle chosen type for current selection.

##### `complete: (type: NonNullable<PrefixType>, text: string, content?: string | null) => void`

Complete current prefix by replacing trigger and prefix with given text. Has no effect if no active prefix.

### Types

#### `DISPLAY_TYPE`

The format types supported by this library.

```typescript
enum DISPLAY_TYPE {
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
```

#### `MENTION_TYPE`

```typescript
enum MENTION_TYPE {
  ONE,
  TWO,
  THREE,
}
```

#### `ManualType`

Types that can be toggled and typed in. All other types are either detected (e.g. links) and/or completed (e.g. mentions).

```typescript
type ManualType =
  | DISPLAY_TYPE.BOLD
  | DISPLAY_TYPE.CODE
  | DISPLAY_TYPE.CODE_BLOCK
  | DISPLAY_TYPE.ITALIC
  | DISPLAY_TYPE.STRIKE_THROUGH
```

#### `PrefixType`

Types for which prefixes are emitted and can be completed.

```typescript
type PrefixType = DISPLAY_TYPE.EMOJI | DISPLAY_TYPE.MENTION | null
```

#### `PrefixTrigger`

Characters which trigger completion. Multi char strings are supported but mostly untested.

```typescript
interface PrefixTrigger {
  emoji: string
  mention: string
}
```

#### `Attribute`

```typescript
type Attribute = {
  start: number
  length: number
  type: DISPLAY_TYPE
  content: string | null
}
```

#### `AttributeStyle`

Custom styling for attributed ranges. Supports limited subset of `TextStyle`.

```typescript
interface AttributeStyle {
  code?: {
    backgroundColor?: ColorValue
    color?: ColorValue
    fontFamily?: string
    fontSize?: number
  }
  codeBlock?: {
    backgroundColor?: ColorValue
    color?: ColorValue
    fontFamily?: string
    fontSize?: number
  }
  emoji?: {
    fontSize?: number
  }
  link?: {
    color?: ColorValue
  }
  mentionOne?: {
    backgroundColor?: ColorValue
    borderRadius?: number
    color?: ColorValue
  }
  mentionTwo?: {
    backgroundColor?: ColorValue
    borderRadius?: number
    color?: ColorValue
  }
  mentionThree?: {
    backgroundColor?: ColorValue
    borderRadius?: number
    color?: ColorValue
  }
}
```

#### `Protocol`

Custom protocols/uri schemes to be recognized within input. By default only http links are recognized.
For more information see [linkifyjs documentation](https://linkify.js.org/docs/linkifyjs.html#linkifyregistercustomprotocol-scheme--optionalslashslash--false).

```typescript
type Protocol = {
  scheme: string
  optionalSlashSlash: boolean
}
```
