'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Extension, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';

// ─── Video Embed Extension ──────────────────────────────────
export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-src] iframe',
        getAttrs: (node) => {
          if (typeof node === 'string') return {};
          return { src: (node as HTMLElement).getAttribute('src') };
        },
      },
      {
        tag: 'div.video-embed-block',
        getAttrs: (node) => {
          if (typeof node === 'string') return {};
          const iframe = (node as HTMLElement).querySelector('iframe');
          return { src: iframe?.getAttribute('src') || null };
        },
      },
      { tag: 'iframe[src]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src;
    return [
      'div',
      {
        class: 'video-embed-block',
        style: 'position: relative; display: block; width: 100%;',
        'data-video-src': src,
      },
      [
        'iframe',
        {
          src,
          frameborder: '0',
          allowfullscreen: 'true',
          allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',
          style: 'width: 100%; height: 480px; border-radius: 10px;',
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },
});

// Separate component to avoid stale closure on editor.isEditable
function VideoEmbedView({ node, editor, deleteNode }: NodeViewProps) {
  const [hover, setHover] = useState(false);
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      className="video-embed-block"
      style={{ position: 'relative', display: 'block', width: '100%' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {isEditable && (
        <div
          data-drag-handle
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 20,
            cursor: 'grab',
            background: 'rgba(0,0,0,0.5)',
            padding: '4px',
            borderRadius: '4px',
            color: '#fff',
          }}
        >
          ⠿
        </div>
      )}
      <iframe
        src={node.attrs.src}
        frameBorder="0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          width: '100%',
          height: '480px',
          borderRadius: '10px',
          pointerEvents: isEditable ? 'none' : 'auto',
        }}
      />
      {isEditable && hover && (
        <button
          onClick={() => deleteNode()}
          title="Remove video"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: '#ff2a55',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '6px 10px',
            cursor: 'pointer',
            zIndex: 20,
            fontSize: 12,
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          🗑️ Remove
        </button>
      )}
    </NodeViewWrapper>
  );
}

// ─── Font Size Extension ────────────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize?.replace('px', '') || null,
            renderHTML: (attrs) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}px` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});

// ─── Toolbar Button ──────────────────────────────────────────
function ToolBtn({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
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

// ─── Upload Progress Overlay ─────────────────────────────────
function UploadOverlay({
  visible,
  label,
  progress,
}: {
  visible: boolean;
  label: string;
  progress: number;
}) {
  if (!visible) return null;
  return (
    <div className="editor-upload-overlay">
      <div className="editor-upload-card">
        <div className="editor-upload-spinner" />
        <div className="editor-upload-label">{label}</div>
        <div className="editor-upload-bar-wrap">
          <div className="editor-upload-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="editor-upload-pct">{progress}%</div>
      </div>
    </div>
  );
}

interface ModuleVideo {
  id: string;
  module_id: string;
  title: string;
  video_url: string;
  drive_email: string;
  sort_order: number;
}

// ─── Toolbar ────────────────────────────────────────────────
function EditorToolbar({
  editor,
  onImageUpload,
  onVideoUpload,
  uploading,
  moduleVideos,
  onInsertVideo,
}: {
  editor: Editor | null;
  onImageUpload: () => void;
  onVideoUpload: () => void;
  uploading: boolean;
  moduleVideos?: ModuleVideo[];
  onInsertVideo?: (video: ModuleVideo) => void;
}) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);

  if (!editor) return null;

  function applyLink() {
    if (!linkUrl) {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: linkUrl, target: '_blank' })
      .run();
    setLinkUrl('');
    setShowLink(false);
  }

  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

  return (
    <div className="editor-toolbar">
      <div className="editor-tool-group">
        <ToolBtn
          title="Normal text"
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')}
        >
          ¶
        </ToolBtn>
        <ToolBtn
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolBtn>
        <ToolBtn
          title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          H3
        </ToolBtn>
        <ToolBtn
          title="Heading 4"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          active={editor.isActive('heading', { level: 4 })}
        >
          H4
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <ToolBtn
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <b>B</b>
        </ToolBtn>
        <ToolBtn
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <i>I</i>
        </ToolBtn>
        <ToolBtn
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
        >
          <u>U</u>
        </ToolBtn>
        <ToolBtn
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
        >
          <s>S</s>
        </ToolBtn>
        <ToolBtn
          title="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
        >
          {'<>'}
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <select
          title="Font size"
          className="editor-font-select"
          onChange={(e) =>
            editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()
          }
          defaultValue=""
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={String(s)}>
              {s}px
            </option>
          ))}
        </select>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <label
          className="editor-tool-btn"
          title="Text color"
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <span>🎨</span>
          <input
            type="color"
            style={{ position: 'absolute', opacity: 0, width: 24, height: 24, cursor: 'pointer' }}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <ToolBtn title="Remove color" onClick={() => editor.chain().focus().unsetColor().run()}>
          ✕
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <ToolBtn
          title="Align left"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
        >
          ⬅
        </ToolBtn>
        <ToolBtn
          title="Align center"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
        >
          ☰
        </ToolBtn>
        <ToolBtn
          title="Align right"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
        >
          ➡
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <ToolBtn
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          • List
        </ToolBtn>
        <ToolBtn
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          1. List
        </ToolBtn>
        <ToolBtn
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          ❝
        </ToolBtn>
        <ToolBtn
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          ——
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group" style={{ position: 'relative' }}>
        <ToolBtn
          title="Add link"
          onClick={() => setShowLink((v) => !v)}
          active={editor.isActive('link')}
        >
          🔗
        </ToolBtn>
        <ToolBtn title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
          🔗✕
        </ToolBtn>
        {showLink && (
          <div className="editor-link-popup">
            <input
              className="editor-link-input"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink();
                if (e.key === 'Escape') setShowLink(false);
              }}
              autoFocus
            />
            <button type="button" className="editor-link-apply" onClick={applyLink}>
              Apply
            </button>
          </div>
        )}
      </div>
      <div className="editor-tool-divider" />

      <div className="editor-tool-group">
        <ToolBtn title="Upload Image" onClick={onImageUpload} disabled={uploading}>
          {uploading ? '⏳' : '🖼️ Image'}
        </ToolBtn>
        <ToolBtn title="Upload Video to Bunny Stream" onClick={onVideoUpload} disabled={uploading}>
          {uploading ? '⏳' : '🎬 Video'}
        </ToolBtn>
      </div>

      {moduleVideos && moduleVideos.length > 0 && (
        <>
          <div className="editor-tool-divider" />
          <div className="editor-tool-group" style={{ position: 'relative' }}>
            <select
              title="Insert Video"
              className="editor-font-select"
              style={{ minWidth: 140, maxWidth: 200 }}
              value=""
              onChange={(e) => {
                const videoId = e.target.value;
                if (!videoId || !onInsertVideo) return;
                const video = moduleVideos.find((v) => v.id === videoId);
                if (video) onInsertVideo(video);
                e.target.value = '';
              }}
            >
              <option value="" disabled>
                📽️ Insert Video
              </option>
              {moduleVideos.map((v, i) => (
                <option key={v.id} value={v.id}>
                  {i + 1}. {v.title.slice(0, 30)}
                  {v.title.length > 30 ? '…' : ''}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="editor-tool-divider" />
      <div className="editor-tool-group">
        <ToolBtn
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          ↩
        </ToolBtn>
        <ToolBtn
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          ↪
        </ToolBtn>
      </div>
    </div>
  );
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  imageUrl: string | null;
}

interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  moduleVideos?: ModuleVideo[];
}

export default function BlockEditor({
  content,
  onChange,
  placeholder,
  readOnly = false,
  moduleVideos = [],
}: BlockEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isInternalUpdate = useRef(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  // Track last synced content to avoid unnecessary updates and infinite loops
  const lastSyncedContent = useRef<string>('');

  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    imageUrl: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      // Native TipTap image extension used here
      Image.configure({
        HTMLAttributes: { class: 'editor-img' },
        allowBase64: true,
        inline: false,
      }),
      VideoEmbed,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing module content here…',
      }),
    ],
    content: content || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current || readOnly) return;
      const html = editor.getHTML();
      lastSyncedContent.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (content === lastSyncedContent.current) return;

    const currentHtml = editor.getHTML();
    const incomingIsEmpty = !content || content === '<p></p>';
    const editorIsEmpty = !currentHtml || currentHtml === '<p></p>';

    if (incomingIsEmpty && editorIsEmpty) {
      lastSyncedContent.current = content;
      return;
    }

    if (content !== currentHtml) {
      isInternalUpdate.current = true;
      editor.commands.setContent(content || '', { emitUpdate: false });
      isInternalUpdate.current = false;
    }

    lastSyncedContent.current = content;
  }, [content, editor]);

  // Context menu for image clicks (edit mode only)
  useEffect(() => {
    if (!editor || readOnly) return;

    function handleEditorClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const img = target.closest('img') as HTMLImageElement | null;
      if (img && img.classList.contains('editor-img')) {
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const wrapRect = editorWrapRef.current?.getBoundingClientRect();
        const x = rect.left - (wrapRect?.left || 0) + rect.width / 2;
        const y = rect.top - (wrapRect?.top || 0) - 8;
        setCtxMenu({ visible: true, x, y, imageUrl: img.src });
        return;
      }
      setCtxMenu((prev) => ({ ...prev, visible: false }));
      setDeleteConfirm(false);
    }

    const editorEl = editorWrapRef.current;
    if (editorEl) {
      editorEl.addEventListener('click', handleEditorClick);
      return () => editorEl.removeEventListener('click', handleEditorClick);
    }
  }, [editor, readOnly]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.editor-ctx-menu')) {
        setCtxMenu((prev) => ({ ...prev, visible: false }));
        setDeleteConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function handleRemoveImage(permanent: boolean) {
    if (!editor || !ctxMenu.imageUrl || readOnly) return;

    if (permanent) {
      setDeleting(true);
      try {
        const url = ctxMenu.imageUrl;
        const match = url.match(/module-images\/(.+)$/);
        const filename = match ? match[1] : null;
        if (filename) {
          await fetch('/api/upload-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
          });
        }
      } catch (err) {
        console.error('Failed to delete from Supabase:', err);
      } finally {
        setDeleting(false);
      }
    }

    const html = editor.getHTML();
    const escapedSrc = ctxMenu.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newHtml = html.replace(new RegExp(`<img[^>]*src="${escapedSrc}"[^>]*>`, 'gi'), '');
    isInternalUpdate.current = true;
    editor.commands.setContent(newHtml, { emitUpdate: false });
    isInternalUpdate.current = false;
    lastSyncedContent.current = newHtml;
    onChange(editor.getHTML());
    setCtxMenu((prev) => ({ ...prev, visible: false }));
    setDeleteConfirm(false);
  }

  const triggerImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);
  const triggerVideoUpload = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor || readOnly) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadLabel('Uploading image…');
    setUploadProgress(10);

    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        setUploadProgress(20 + attempt * 30);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        setUploadProgress(80);

        let data: any = {};
        if (res.headers.get('content-type')?.includes('application/json')) {
          data = await res.json();
        } else {
          data.error =
            res.status === 413
              ? 'Image too large. Max size 10MB.'
              : `Server error (${res.status})`;
        }

        if (!res.ok) {
          lastError = data.error || 'Image upload failed';
          if (res.status >= 500 && attempt < 1) {
            setUploadLabel('Retrying upload…');
            continue;
          }
          setUploadError(lastError);
        } else {
          setUploadProgress(100);
          editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
          const newHtml = editor.getHTML();
          lastSyncedContent.current = newHtml;
          onChange(newHtml);
          setUploadSuccess('✅ Image uploaded!');
          setTimeout(() => setUploadSuccess(''), 3000);
          lastError = '';
        }
        break;
      } catch {
        lastError =
          attempt >= 1
            ? 'Network error. Please check your connection and try again.'
            : 'Network error. Retrying…';
      }
    }

    if (lastError) setUploadError(lastError);
    setUploading(false);
    setUploadProgress(0);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor || readOnly) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadLabel(`Uploading video "${file.name}" to Bunny Stream…`);
    setUploadProgress(5);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^/.]+$/, ''));
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 3, 85));
      }, 800);
      const res = await fetch('/api/bunny/upload-video', { method: 'POST', body: fd });
      clearInterval(progressInterval);
      setUploadProgress(95);
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Video upload failed.');
      } else {
        setUploadProgress(100);
        editor
          .chain()
          .focus()
          .insertContent({ type: 'videoEmbed', attrs: { src: data.embedUrl } })
          .run();
        const newHtml = editor.getHTML();
        lastSyncedContent.current = newHtml;
        onChange(newHtml);
        setUploadSuccess('✅ Video uploaded to Bunny Stream!');
        setTimeout(() => setUploadSuccess(''), 4000);
      }
    } catch {
      setUploadError('Network error uploading video. Please try again.');
    }

    setUploading(false);
    setUploadProgress(0);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  return (
    <div
      className={`block-editor-wrap ${readOnly ? 'read-only' : ''}`}
      ref={editorWrapRef}
      style={{
        position: 'relative',
        border: readOnly ? 'none' : undefined,
        minHeight: readOnly ? 'auto' : undefined,
        boxShadow: readOnly ? 'none' : undefined,
      }}
    >
      {!readOnly && (
        <UploadOverlay visible={uploading} label={uploadLabel} progress={uploadProgress} />
      )}

      {!readOnly && (
        <EditorToolbar
          editor={editor}
          onImageUpload={triggerImageUpload}
          onVideoUpload={triggerVideoUpload}
          uploading={uploading}
          moduleVideos={moduleVideos}
          onInsertVideo={(video) => {
            if (!editor) return;
            editor
              .chain()
              .focus()
              .insertContent({ type: 'videoEmbed', attrs: { src: video.video_url } })
              .run();
            const newHtml = editor.getHTML();
            lastSyncedContent.current = newHtml;
            onChange(newHtml);
          }}
        />
      )}

      <EditorContent
        editor={editor}
        className={`editor-content-area ${readOnly ? 'editor-readonly' : ''}`}
        style={readOnly ? { padding: 0, minHeight: 'auto' } : {}}
      />

      {!readOnly && ctxMenu.visible && (
        <div
          className="editor-ctx-menu"
          style={{
            position: 'absolute',
            left: Math.min(ctxMenu.x, (editorWrapRef.current?.offsetWidth || 600) - 220),
            top: ctxMenu.y,
            zIndex: 200,
            background: '#fff',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: '6px',
            minWidth: 200,
            transform: 'translateX(-50%) translateY(-100%)',
          }}
        >
          {ctxMenu.imageUrl && (
            <>
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 4,
                }}
              >
                🖼️ Image Options
              </div>
              {!deleteConfirm ? (
                <>
                  <button
                    className="editor-ctx-btn"
                    onClick={() => handleRemoveImage(false)}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    🗑️ Remove from content
                  </button>
                  <button
                    className="editor-ctx-btn editor-ctx-btn-danger"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    ❌ Delete permanently (Supabase)
                  </button>
                </>
              ) : (
                <div style={{ padding: '8px 10px' }}>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#b91c1c',
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ This will permanently delete from Supabase storage. Are you sure?
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="editor-ctx-btn editor-ctx-btn-danger"
                      onClick={() => handleRemoveImage(true)}
                      disabled={deleting}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {deleting ? '⏳ Deleting…' : '✓ Yes, Delete'}
                    </button>
                    <button
                      className="editor-ctx-btn"
                      onClick={() => setDeleteConfirm(false)}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!readOnly && uploadError && (
        <div className="editor-status editor-status-error">❌ {uploadError}</div>
      )}
      {!readOnly && uploadSuccess && (
        <div className="editor-status editor-status-success">{uploadSuccess}</div>
      )}
      {!readOnly && (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFile}
        />
      )}
      {!readOnly && (
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoFile}
        />
      )}
    </div>
  );
}
