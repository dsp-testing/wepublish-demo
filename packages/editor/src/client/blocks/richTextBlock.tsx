import React, {useState, memo, useEffect, useMemo} from 'react'
import {Editor, Node as SlateNode, createEditor, Range, Transforms} from 'slate'

import {
  useSlate,
  Editable,
  RenderElementProps,
  Slate,
  withReact,
  RenderLeafProps,
  ReactEditor
} from 'slate-react'

import {withHistory} from 'slate-history'
import {jsx} from 'slate-hyperscript'

import {
  MaterialIconFormatBold,
  MaterialIconFormatItalic,
  MaterialIconFormatUnderlined,
  MaterialIconFormatStrikethrough,
  MaterialIconLooksTwoOutlined,
  MaterialIconLooks3Outlined,
  MaterialIconFormatListBulleted,
  MaterialIconFormatListNumbered,
  MaterialIconLooksOneOutlined,
  MaterialIconLink,
  MaterialIconLinkOff,
  MaterialIconClose,
  MaterialIconCheck
} from '@karma.run/icons'

import {
  Typography,
  ToolbarButtonProps,
  ToolbarButton,
  ToolbarDivider,
  Link,
  BlockProps,
  Toolbar,
  Dialog,
  Panel,
  PanelHeader,
  NavigationButton,
  PanelSection,
  TextInput,
  Spacing,
  Box
} from '@karma.run/ui'
import {RichTextBlockValue} from './types'

enum BlockFormat {
  H1 = 'heading-one',
  H2 = 'heading-two',
  H3 = 'heading-three',
  Paragraph = 'paragraph',
  UnorderedList = 'unordered-list',
  OrderedList = 'ordered-list',
  ListItem = 'list-item'
}

enum InlineFormat {
  Link = 'link'
}

enum TextFormat {
  Bold = 'bold',
  Italic = 'italic',
  Underline = 'underline',
  Strikethrough = 'strikethrough'
}

type Format = BlockFormat | InlineFormat | TextFormat

const BlockFormats: string[] = Object.values(BlockFormat)
const InlineFormats: string[] = Object.values(InlineFormat)
const TextFormats: string[] = Object.values(TextFormat)
const ListFormats: string[] = [BlockFormat.UnorderedList, BlockFormat.OrderedList]

const ElementTags: any = {
  A: (el: Element) => ({
    type: InlineFormat.Link,
    url: el.getAttribute('data-href') || el.getAttribute('href'),
    title: el.getAttribute('data-title') || el.getAttribute('title')
  }),
  H1: () => ({type: BlockFormat.H1}),
  H2: () => ({type: BlockFormat.H2}),
  H3: () => ({type: BlockFormat.H3}),
  P: () => ({type: BlockFormat.Paragraph}),
  LI: () => ({type: BlockFormat.ListItem}),
  OL: () => ({type: BlockFormat.OrderedList}),
  UL: () => ({type: BlockFormat.UnorderedList})
}

const TextTags: any = {
  S: () => ({[TextFormat.Strikethrough]: true}),
  DEL: () => ({[TextFormat.Strikethrough]: true}),
  EM: () => ({[TextFormat.Italic]: true}),
  I: () => ({[TextFormat.Italic]: true}),
  STRONG: () => ({[TextFormat.Bold]: true}),
  B: () => ({[TextFormat.Bold]: true}),
  U: () => ({[TextFormat.Underline]: true})
}

function deserialize(element: Element): any {
  const {nodeName, nodeType} = element

  if (nodeType === Node.TEXT_NODE) {
    return element.textContent
  } else if (nodeType !== Node.ELEMENT_NODE) {
    return null
  } else if (nodeName === 'BR') {
    return '\n'
  }

  let parent: Element = element

  if (nodeName === 'PRE' && element.childNodes[0] && element.childNodes[0].nodeName === 'CODE') {
    parent = element.childNodes[0] as Element
  }

  const children = Array.from(parent.childNodes)
    .map(element => deserialize(element as Element))
    .flat()

  if (nodeName === 'BODY') {
    return jsx('fragment', {}, children)
  }

  if (ElementTags[nodeName]) {
    const attrs = ElementTags[nodeName](element)
    return jsx('element', attrs, children)
  }

  if (TextTags[nodeName]) {
    const attrs = TextTags[nodeName](element)

    if (!children.some(child => child.children !== undefined)) {
      return children.map(child => {
        return jsx('text', attrs, child)
      })
    }
  }

  return children
}

function renderElement({attributes, children, element}: RenderElementProps) {
  switch (element.type) {
    case BlockFormat.H1:
      return (
        <Typography variant="h1" spacing="small" {...attributes}>
          {children}
        </Typography>
      )

    case BlockFormat.H2:
      return (
        <Typography variant="h2" spacing="small" {...attributes}>
          {children}
        </Typography>
      )

    case BlockFormat.H3:
      return (
        <Typography variant="h3" spacing="small" {...attributes}>
          {children}
        </Typography>
      )

    case BlockFormat.UnorderedList:
      return <ul {...attributes}>{children}</ul>

    case BlockFormat.OrderedList:
      return <ol {...attributes}>{children}</ol>

    case BlockFormat.ListItem:
      return <li {...attributes}>{children}</li>

    case InlineFormat.Link:
      // TODO: Implement custom tooltip
      // const title = element.title ? `${element.title}: ${element.url}` : element.url
      // title={title}

      return (
        <Link data-title={element.title} data-href={element.url} {...attributes}>
          {children}
        </Link>
      )

    default:
      return (
        <Typography variant="body1" spacing="large" {...attributes}>
          {children}
        </Typography>
      )
  }
}

function renderLeaf({attributes, children, leaf}: RenderLeafProps) {
  if (leaf[TextFormat.Bold]) {
    children = <strong {...attributes}>{children}</strong>
  }

  if (leaf[TextFormat.Italic]) {
    children = <em {...attributes}>{children}</em>
  }

  if (leaf[TextFormat.Underline]) {
    children = <u {...attributes}>{children}</u>
  }

  if (leaf[TextFormat.Strikethrough]) {
    children = <del {...attributes}>{children}</del>
  }

  return <span {...attributes}>{children}</span>
}

// TODO: Re-implement via `normalizeNode`
// See: https://github.com/ianstormtaylor/slate/blob/master/Changelog.md#0530--december-10-2019

// const withSchema = defineSchema([
//   {
//     for: 'node',
//     match: 'editor',
//     validate: {
//       children: [
//         {
//           match: [
//             ([node]) =>
//               node.type === BlockFormat.H1 ||
//               node.type === BlockFormat.H2 ||
//               node.type === BlockFormat.H3 ||
//               node.type === BlockFormat.UnorderedList ||
//               node.type === BlockFormat.OrderedList ||
//               node.type === BlockFormat.Paragraph ||
//               node.type === InlineFormat.Link
//           ]
//         }
//       ]
//     },
//     normalize: (editor, error) => {
//       const {code, path} = error

//       switch (code) {
//         case 'child_invalid':
//           Editor.setNodes(editor, {type: BlockFormat.Paragraph}, {at: path})
//           break
//       }
//     }
//   },

//   {
//     for: 'node',
//     match: ([node]) =>
//       node.type === BlockFormat.UnorderedList || node.type === BlockFormat.OrderedList,
//     validate: {
//       children: [{match: [([node]) => node.type === BlockFormat.ListItem]}]
//     },
//     normalize: (editor, error) => {
//       const {code, path} = error

//       switch (code) {
//         case 'child_invalid':
//           Editor.setNodes(editor, {type: BlockFormat.ListItem}, {at: path})
//           break
//       }
//     }
//   }
// ])

export type RichTextBlockProps = BlockProps<RichTextBlockValue>

export const RichTextBlock = memo(function RichTextBlock({
  value,
  autofocus,
  disabled,
  onChange
}: RichTextBlockProps) {
  const editor = useMemo(() => withRichText(withHistory(withReact(createEditor()))), [])
  const [hasFocus, setFocus] = useState(false)

  useEffect(() => {
    if (autofocus) {
      ReactEditor.focus(editor)
    }
  }, [])

  return (
    <Slate
      editor={editor}
      value={value}
      onChange={(newValue: SlateNode[]) => {
        setFocus(ReactEditor.isFocused(editor))
        if (value !== newValue) onChange(newValue)
      }}>
      <Toolbar fadeOut={!hasFocus}>
        <FormatButton icon={MaterialIconLooksOneOutlined} format={BlockFormat.H1} />
        <FormatButton icon={MaterialIconLooksTwoOutlined} format={BlockFormat.H2} />
        <FormatButton icon={MaterialIconLooks3Outlined} format={BlockFormat.H3} />

        <ToolbarDivider />

        <FormatButton icon={MaterialIconFormatListBulleted} format={BlockFormat.UnorderedList} />
        <FormatButton icon={MaterialIconFormatListNumbered} format={BlockFormat.OrderedList} />

        <ToolbarDivider />

        <FormatButton icon={MaterialIconFormatBold} format={TextFormat.Bold} />
        <FormatButton icon={MaterialIconFormatItalic} format={TextFormat.Italic} />
        <FormatButton icon={MaterialIconFormatUnderlined} format={TextFormat.Underline} />
        <FormatButton icon={MaterialIconFormatStrikethrough} format={TextFormat.Strikethrough} />

        <ToolbarDivider />

        <LinkFormatButton />
        <RemoveLinkFormatButton />
      </Toolbar>
      <Editable
        readOnly={disabled}
        placeholder="Start writing..."
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  )
})

interface SlateBlockButtonProps extends ToolbarButtonProps {
  readonly format: Format
}

function FormatButton({icon, format}: SlateBlockButtonProps) {
  const editor = useSlate()

  return (
    <ToolbarButton
      icon={icon}
      active={isFormatActive(editor, format)}
      onMouseDown={e => {
        e.preventDefault()
        toggleFormat(editor, format)
      }}
    />
  )
}

function LinkFormatButton() {
  const editor = useSlate()
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selection, setSelection] = useState<Range | null>(null)

  const [title, setTitle] = useState('')
  const [url, setURL] = useState('')

  const validatedURL = validateURL(url)
  const isDisabled = !validatedURL

  return (
    <>
      <ToolbarButton
        icon={MaterialIconLink}
        active={isFormatActive(editor, InlineFormat.Link)}
        onMouseDown={e => {
          e.preventDefault()

          const nodes = Array.from(
            Editor.nodes(editor, {
              at: editor.selection ?? undefined,
              match: node => node.type === InlineFormat.Link
            })
          )

          const tuple = nodes[0]

          if (tuple) {
            const [node] = tuple

            setTitle((node.title as string) ?? '')
            setURL((node.url as string) ?? '')
          } else {
            setTitle('')
            setURL('')
          }

          setSelection(editor.selection)
          setLinkDialogOpen(true)
        }}
      />
      <Dialog open={isLinkDialogOpen}>
        {() => (
          <Panel>
            <PanelHeader
              leftChildren={
                <NavigationButton
                  icon={MaterialIconClose}
                  label="Cancel"
                  onClick={() => setLinkDialogOpen(false)}
                />
              }
              rightChildren={
                <NavigationButton
                  icon={MaterialIconCheck}
                  disabled={isDisabled}
                  label="Apply"
                  onClick={() => {
                    insertLink(editor, selection, validatedURL!, title || undefined)
                    setLinkDialogOpen(false)
                  }}
                />
              }
            />
            <PanelSection>
              <Box width={300}>
                <TextInput
                  label="Link"
                  errorMessage={url && !validatedURL ? 'Invalid Link' : undefined}
                  value={url}
                  onChange={e => setURL(e.target.value)}
                  marginBottom={Spacing.ExtraSmall}
                />
                <TextInput
                  label="Title"
                  description="Optional description for the link"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </Box>
            </PanelSection>
          </Panel>
        )}
      </Dialog>
    </>
  )
}

function validateURL(url: string): string | null {
  return url

  // TODO: Implement better URL validation with for support relative links.
  // try {
  //   return new URL(url).toString()
  // } catch (err) {
  //   try {
  //     return new URL(`https://${url}`).toString()
  //   } catch (err) {
  //     return null
  //   }
  // }
}

function RemoveLinkFormatButton() {
  const editor = useSlate()

  return (
    <ToolbarButton
      icon={MaterialIconLinkOff}
      active={isFormatActive(editor, InlineFormat.Link)}
      disabled={!isFormatActive(editor, InlineFormat.Link)}
      onMouseDown={e => {
        e.preventDefault()
        removeLink(editor)
      }}
    />
  )
}

function isFormatActive(editor: Editor, format: Format) {
  if (TextFormats.includes(format)) {
    const marks = Editor.marks(editor)
    return marks ? marks[format] === true : false
  }

  if (BlockFormats.includes(format) || InlineFormats.includes(format)) {
    const [match] = Editor.nodes(editor, {
      match: node => node.type === format,
      mode: 'all'
    })

    return !!match
  }

  return false
}

function toggleFormat(editor: Editor, format: Format) {
  const isActive = isFormatActive(editor, format)
  const isList = ListFormats.includes(format)

  if (TextFormats.includes(format)) {
    if (isActive) {
      editor.removeMark(format)
    } else {
      editor.addMark(format, true)
    }
  }

  if (BlockFormats.includes(format)) {
    for (const format of ListFormats) {
      Transforms.unwrapNodes(editor, {match: node => node.type === format, split: true})
    }

    Transforms.setNodes(editor, {
      type: isActive ? BlockFormat.Paragraph : isList ? BlockFormat.ListItem : format
    })

    if (!isActive && isList) {
      Transforms.wrapNodes(editor, {type: format, children: []})
    }
  }
}

function insertLink(editor: Editor, selection: Range | null, url: string, title?: string) {
  if (selection) {
    if (Range.isCollapsed(selection)) {
      const nodes = Array.from(
        Editor.nodes(editor, {
          at: selection,
          match: node => node.type === InlineFormat.Link
        })
      )

      const tuple = nodes[0]

      if (tuple) {
        const [, path] = tuple
        Transforms.select(editor, path)
      }
    } else {
      Transforms.select(editor, selection)
    }
  }

  Transforms.unwrapNodes(editor, {match: node => node.type === InlineFormat.Link})
  Transforms.wrapNodes(editor, {type: InlineFormat.Link, url, title, children: []}, {split: true})
  Transforms.collapse(editor, {edge: 'end'})
}

function removeLink(editor: Editor) {
  Transforms.unwrapNodes(editor, {match: node => node.type === InlineFormat.Link})
}

function withRichText<T extends ReactEditor>(editor: T): T {
  const {insertData, isInline} = editor

  editor.isInline = node => (InlineFormats.includes(node.type as string) ? true : isInline(node))
  editor.insertData = (data: any) => {
    const html = data.getData('text/html')

    if (html) {
      const parsed = new DOMParser().parseFromString(html, 'text/html')
      const fragment = deserialize(parsed.body)
      Editor.insertFragment(editor, fragment)
    } else {
      insertData(data)
    }
  }

  return editor
}

export function createDefaultValue(): RichTextBlockValue {
  return [{type: BlockFormat.Paragraph, children: [{text: ''}]}]
}
