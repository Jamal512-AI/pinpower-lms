'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import ImageResize from 'tiptap-extension-resize-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

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
        tag: 'div.video-embed-block iframe[src]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {};
          return { src: (node as HTMLElement).getAttribute('src') };
        },
      },
      { tag: 'iframe[src]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src;
    return [
      'div',
      { class: 'video-embed-block', style: 'position: relative; display: block; width: 100%;', 'data-video-src': src },
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
      [
        'div',
        {
          class: 'video-overlay',
          'data-video-src': src,
          title: 'Click to play in secure player',
          style: 'position: absolute; inset: 0; z-index: 10; cursor: pointer; background: transparent;'
        }
      ]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node, editor, deleteNode }) => {
      const [hover, setHover] = useState(false);
      return (
        <NodeViewWrapper 
          className="video-embed-block" 
          style={{ position: 'relative', display: 'block', width: '100%' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {/* Draggable handle for editor, disabled for student */}
          {editor.isEditable && (
            <div data-drag-handle style={{ position: 'absolute', top: 8, left: 8, zIndex: 20, cursor: 'grab', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '4px' }}>
              ⠿
            </div>
          )}
          <iframe
            src={node.attrs.src}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: '100%', height: '480px', borderRadius: '10px', pointerEvents: 'auto' }}
          />
          {editor.isEditable && hover && (
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
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              🗑️ Remove
            </button>
          )}
        </NodeViewWrapper>
      );
    });
  },
});

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

// ─── Toolbar Button ──────────────────────────────────────────
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

// ─── Upload Progress Overlay ─────────────────────────────────
function UploadOverlay({ visible, label, progress }: {
  visible: boolean; label: string; progress: number;
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

// ─── Module Video Type (used by toolbar + block editor) ─────────────
interface ModuleVideo {
  id: string;
  module_id: string;
  title: string;
  video_url: string;
  drive_email: string;
  sort_order: number;
}

// ─── Toolbar ────────────────────────────────────────────────
function EditorToolbar({ editor, onImageUpload, onVideoUpload, uploading, moduleVideos, onInsertVideo }: {
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
    if (!linkUrl) { editor!.chain().focus().unsetLink().run(); return; }
    editor!.chain().focus().extendMarkRange('link')
      .setLink({ href: linkUrl, target: '_blank' }).run();
    setLinkUrl('');
    setShowLink(false);
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
        <select
          title="Font size"
          className="editor-font-select"
          onChange={e => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
          defaultValue=""
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}px</option>)}
        </select>
      </div>
      <div className="editor-tool-divider" />

      {/* Color */}
      <div className="editor-tool-group">
        <label className="editor-tool-btn" title="Text color" style={{ cursor: 'pointer', position: 'relative' }}>
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
              onKeyDown={e => {
                if (e.key === 'Enter') applyLink();
                if (e.key === 'Escape') setShowLink(false);
              }}
              autoFocus
            />
            <button type="button" className="editor-link-apply" onClick={applyLink}>Apply</button>
          </div>
        )}
      </div>
      <div className="editor-tool-divider" />

      {/* Image + Video upload */}
      <div className="editor-tool-group">
        <ToolBtn title="Upload Image" onClick={onImageUpload} disabled={uploading}>
          {uploading ? '⏳' : '🖼️ Image'}
        </ToolBtn>
        <ToolBtn title="Upload Video to Bunny Stream" onClick={onVideoUpload} disabled={uploading}>
          {uploading ? '⏳' : '🎬 Video'}
        </ToolBtn>
      </div>
      <div className="editor-tool-divider" />

      {/* Insert Video from sidebar list */}
      {moduleVideos && moduleVideos.length > 0 && (
        <>
          <div className="editor-tool-group" style={{ position: 'relative' }}>
            <select
              title="Insert Video"
              className="editor-font-select"
              style={{ minWidth: 140, maxWidth: 200 }}
              value=""
              onChange={e => {
                const videoId = e.target.value;
                if (!videoId || !onInsertVideo) return;
                const video = moduleVideos.find(v => v.id === videoId);
                if (video) onInsertVideo(video);
                e.target.value = '';
              }}
            >
              <option value="" disabled>📽️ Insert Video</option>
              {moduleVideos.map((v, i) => (
                <option key={v.id} value={v.id}>{i + 1}. {v.title.slice(0, 30)}{v.title.length > 30 ? '…' : ''}</option>
              ))}
            </select>
          </div>
          <div className="editor-tool-divider" />
        </>
      )}

      {/* History */}
      <div className="editor-tool-group">
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩</ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪</ToolBtn>
      </div>
    </div>
  );
}

// ─── Context Menu for Image ───────────────────────────
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  imageUrl: string | null;
}

// ─── Main Block Editor ───────────────────────────────────────
interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  moduleVideos?: ModuleVideo[];
  isAdmin?: boolean;
}

export default function BlockEditor({
  content,
  onChange,
  placeholder,
  readOnly = false,
  moduleVideos = [],
  isAdmin = false,
}: BlockEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isInternalUpdate = useRef(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, imageUrl: null,
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
      ImageResize.configure({
        HTMLAttributes: { class: 'editor-img' },
        allowBase64: true,
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
      if (isInternalUpdate.current) return;
      onChange(editor.getHTML());
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor || readOnly) return;
    const current = editor.getHTML();
    if (content && content !== current && content !== '<p></p>') {
      isInternalUpdate.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
      isInternalUpdate.current = false;
    }
  }, [content, editor, readOnly]);

  // ── Click handler on editor content to detect image clicks ──
  useEffect(() => {
    if (!editor || readOnly) return;

    function handleEditorClick(e: MouseEvent) {
      const target = e.target as HTMLElement;

      // Check if clicked on an image
      const img = target.closest('img') as HTMLImageElement | null;
      if (img && img.classList.contains('editor-img')) {
        e.preventDefault();
        const rect = img.getBoundingClientRect();
        const wrapRect = editorWrapRef.current?.getBoundingClientRect();
        const x = rect.left - (wrapRect?.left || 0) + rect.width / 2;
        const y = rect.top - (wrapRect?.top || 0) - 8;
        setCtxMenu({
          visible: true,
          x,
          y,
          imageUrl: img.src,
        });
        return;
      }

      // Close menu if clicking elsewhere
      setCtxMenu(prev => ({ ...prev, visible: false }));
      setDeleteConfirm(false);
    }

    const editorEl = editorWrapRef.current;
    if (editorEl) {
      editorEl.addEventListener('click', handleEditorClick);
      return () => editorEl.removeEventListener('click', handleEditorClick);
    }
  }, [editor, readOnly]);

  // Close context menu on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.editor-ctx-menu')) {
        setCtxMenu(prev => ({ ...prev, visible: false }));
        setDeleteConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Remove image from editor (and optionally delete from Supabase) ──
  async function handleRemoveImage(permanent: boolean) {
    if (!editor || !ctxMenu.imageUrl) return;

    if (permanent) {
      setDeleting(true);
      try {
        // Extract filename from Supabase URL
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

    // Remove from editor
    const html = editor.getHTML();
    // Remove img tag with this src
    const escapedSrc = ctxMenu.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newHtml = html.replace(new RegExp(`<img[^>]*src="${escapedSrc}"[^>]*>`, 'gi'), '');
    isInternalUpdate.current = true;
    editor.commands.setContent(newHtml, { emitUpdate: false });
    isInternalUpdate.current = false;
    onChange(editor.getHTML());
    setCtxMenu(prev => ({ ...prev, visible: false }));
    setDeleteConfirm(false);
  }

  const triggerImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const triggerVideoUpload = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  // ── Image Upload → Supabase Storage ───────────────────────
  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

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
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          body: fd,
        });
        setUploadProgress(80);

        const contentType = res.headers.get('content-type') || '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          data.error =
            res.status === 413
              ? 'Image too large. Max size 10MB.'
              : `Server error (${res.status})`;
          console.error('Non-JSON response:', text);
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
          onChange(editor.getHTML());
          setUploadSuccess('✅ Image uploaded!');
          setTimeout(() => setUploadSuccess(''), 3000);
          lastError = '';
        }
        break;
      } catch {
        lastError = attempt >= 1
          ? 'Network error. Please check your connection and try again.'
          : 'Network error. Retrying…';
      }
    }

    if (lastError) setUploadError(lastError);
    setUploading(false);
    setUploadProgress(0);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  // ── Video Upload → Bunny Stream ────────────────────────────
  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

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
        setUploadProgress(p => Math.min(p + 3, 85));
      }, 800);

      const res = await fetch('/api/bunny/upload-video', { method: 'POST', body: fd });
      clearInterval(progressInterval);
      setUploadProgress(95);
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Video upload failed.');
      } else {
        setUploadProgress(100);
        editor.chain().focus().insertContent({
          type: 'videoEmbed',
          attrs: { src: data.embedUrl }
        }).run();
        onChange(editor.getHTML());
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

  // ── Read-only render ───────────────────────────────────────
  if (readOnly) {
    return (
      <div
        className="editor-readonly"
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
    );
  }

  return (
    <div className="block-editor-wrap" ref={editorWrapRef} style={{ position: 'relative' }}>
      <UploadOverlay
        visible={uploading}
        label={uploadLabel}
        progress={uploadProgress}
      />

      <EditorToolbar
        editor={editor}
        onImageUpload={triggerImageUpload}
        onVideoUpload={triggerVideoUpload}
        uploading={uploading}
        moduleVideos={moduleVideos}
        onInsertVideo={(video) => {
          if (!editor) return;
          editor.chain().focus().insertContent({
            type: 'videoEmbed',
            attrs: { src: video.video_url }
          }).run();
          onChange(editor.getHTML());
        }}
      />

      <EditorContent editor={editor} className="editor-content-area" />

      {/* ── Context Menu for Image/Video ── */}
      {ctxMenu.visible && (
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
              <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
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
                  <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8, fontWeight: 600 }}>
                    ⚠️ This will delete the image from Supabase storage permanently. Are you sure?
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

      {uploadError && (
        <div className="editor-status editor-status-error">
          ❌ {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="editor-status editor-status-success">
          {uploadSuccess}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleVideoFile}
      />
    </div>
  );
}
