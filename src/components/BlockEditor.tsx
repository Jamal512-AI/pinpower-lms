'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TipTapImage from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useCallback, useRef, useState } from 'react';

// ─── Font Size via TextStyle marks ─────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

// Simple font-size extension using TextStyle
import { Extension } from '@tiptap/core';
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize?.replace('px', '') || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}px` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});

// ─── Toolbar Button ─────────────────────────────────────────
function ToolBtn({
  onClick, active, title, children, disabled
}: {
  onClick: () => void; active?: boolean; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`editor-tool-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

// ─── Toolbar ────────────────────────────────────────────────
function EditorToolbar({ editor, onImageUpload, uploading }: {
  editor: Editor | null;
  onImageUpload: () => void;
  uploading: boolean;
}) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);

  if (!editor) return null;

  function applyLink() {
    if (!linkUrl) { editor!.chain().focus().unsetLink().run(); return; }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: linkUrl, target: '_blank' }).run();
    setLinkUrl('');
    setShowLink(false);
  }

  function changeFontSize(delta: number) {
    const el = editor!.view.dom as HTMLElement;
    const current = parseInt(window.getComputedStyle(el).fontSize) || 16;
    const next = Math.max(10, Math.min(72, current + delta));
    editor!.chain().focus().setMark('textStyle', { fontSize: String(next) }).run();
  }

  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

  return (
    <div className="editor-toolbar">
      {/* Headings */}
      <div className="editor-tool-group">
        <ToolBtn title="Normal text" onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>¶</ToolBtn>
        <ToolBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</ToolBtn>
        <ToolBtn title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>H3</ToolBtn>
        <ToolBtn title="Heading 4" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })}>H4</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Text style */}
      <div className="editor-tool-group">
        <ToolBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><b>B</b></ToolBtn>
        <ToolBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><i>I</i></ToolBtn>
        <ToolBtn title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><u>U</u></ToolBtn>
        <ToolBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}><s>S</s></ToolBtn>
        <ToolBtn title="Code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>{'<>'}</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Font size */}
      <div className="editor-tool-group">
        <ToolBtn title="Decrease font size" onClick={() => changeFontSize(-2)}>A−</ToolBtn>
        <select
          title="Font size"
          className="editor-font-select"
          onChange={e => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
          defaultValue=""
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}px</option>)}
        </select>
        <ToolBtn title="Increase font size" onClick={() => changeFontSize(2)}>A+</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Color */}
      <div className="editor-tool-group">
        <label className="editor-tool-btn" title="Text color" style={{ cursor: 'pointer', position: 'relative', overflow: 'visible' }}>
          <span>🎨</span>
          <input
            type="color"
            style={{ position: 'absolute', opacity: 0, width: 24, height: 24, cursor: 'pointer' }}
            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <ToolBtn title="Remove color" onClick={() => editor.chain().focus().unsetColor().run()}>✕</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Alignment */}
      <div className="editor-tool-group">
        <ToolBtn title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>⬅</ToolBtn>
        <ToolBtn title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>☰</ToolBtn>
        <ToolBtn title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>➡</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Lists */}
      <div className="editor-tool-group">
        <ToolBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>• List</ToolBtn>
        <ToolBtn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1. List</ToolBtn>
        <ToolBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>❝</ToolBtn>
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>——</ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* Link */}
      <div className="editor-tool-group" style={{ position: 'relative' }}>
        <ToolBtn title="Add link" onClick={() => setShowLink(v => !v)} active={editor.isActive('link')}>🔗</ToolBtn>
        <ToolBtn title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>🔗✕</ToolBtn>
        {showLink && (
          <div className="editor-link-popup">
            <input
              className="editor-link-input"
              placeholder="https://..."
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLink(false); }}
              autoFocus
            />
            <button type="button" className="editor-link-apply" onClick={applyLink}>Apply</button>
          </div>
        )}
      </div>

      {/* Image upload */}
      <div className="editor-tool-group">
        <ToolBtn title="Upload image to Bunny CDN" onClick={onImageUpload} disabled={uploading}>
          {uploading ? '⏳' : '🖼️'}
        </ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* History */}
      <div className="editor-tool-group">
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩</ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪</ToolBtn>
      </div>
    </div>
  );
}

// ─── Main Block Editor ───────────────────────────────────────
interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function BlockEditor({ content, onChange, placeholder, readOnly = false }: BlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TipTapImage.configure({ HTMLAttributes: { class: 'editor-img' } }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing module content here…' }),
    ],
    content: content || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    setUploading(true);
    setUploadError('');

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/bunny/upload-image', { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) {
      setUploadError(data.error || 'Upload failed');
    } else {
      editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
      onChange(editor.getHTML()); // Force auto-save to Supabase immediately after inserting image
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (readOnly) {
    return (
      <div
        className="editor-readonly"
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
    );
  }

  return (
    <div className="block-editor-wrap">
      <EditorToolbar editor={editor} onImageUpload={triggerImageUpload} uploading={uploading} />
      <EditorContent editor={editor} className="editor-content-area" />
      {uploadError && (
        <div className="alert alert-error" style={{ marginTop: 8, fontSize: 13 }}>
          ❌ Image upload failed: {uploadError}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />
    </div>
  );
}
