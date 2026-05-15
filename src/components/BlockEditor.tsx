'use client';

import { useEditor, EditorContent, Editor, Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TipTapImage from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Extension } from '@tiptap/core';

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
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});

// ─── Video Placeholder Node ──────────────────────────────────
// Stored as: <div data-video-placeholder data-video-id="..." data-video-title="...">
const VideoPlaceholderNode = Node.create({
  name: 'videoPlaceholder',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: { default: '' },
      videoTitle: { default: 'Video' },
      videoIndex: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-video-placeholder]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-video-placeholder': 'true',
        'data-video-id': HTMLAttributes.videoId,
        'data-video-title': HTMLAttributes.videoTitle,
        'data-video-index': HTMLAttributes.videoIndex,
        class: 'video-placeholder-block',
        style: `
          display:flex; align-items:center; gap:14px;
          background:linear-gradient(135deg,#0f172a,#1D4B73);
          border-radius:12px; padding:20px 24px; margin:16px 0;
          border:2px dashed rgba(255,42,85,0.5); cursor:grab;
          user-select:none;
        `,
      }),
      [
        'span',
        { style: 'font-size:32px;' },
        '🎬',
      ],
      [
        'span',
        { style: 'flex:1;' },
        [
          'strong',
          { style: 'color:#fff; font-size:15px; display:block;' },
          `Video: ${HTMLAttributes.videoTitle}`,
        ],
        [
          'small',
          { style: 'color:rgba(255,255,255,0.5); font-size:12px;' },
          'This video will play inline for students here',
        ],
      ],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor: editorInstance }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-video-placeholder', 'true');
      dom.setAttribute('draggable', 'true');
      dom.style.cssText = `
        display:flex; align-items:center; gap:14px;
        background:linear-gradient(135deg,#0f172a 0%,#1D4B73 100%);
        border-radius:12px; padding:20px 24px; margin:16px 0;
        border:2px dashed rgba(255,42,85,0.6); cursor:grab;
        user-select:none; position:relative;
      `;

      dom.innerHTML = `
        <span style="font-size:36px;flex-shrink:0;">🎬</span>
        <div style="flex:1;min-width:0;">
          <div style="color:#fff;font-weight:700;font-size:15px;margin-bottom:2px;">
            ${node.attrs.videoTitle || 'Video'}
          </div>
          <div style="color:rgba(255,255,255,0.5);font-size:12px;">
            Students will see this video embedded here
          </div>
        </div>
        <button
          data-delete-vp
          title="Remove video placeholder"
          style="
            background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);
            border-radius:6px;color:#f87171;cursor:pointer;padding:6px 10px;
            font-size:13px;flex-shrink:0;transition:all 0.15s;
          "
        >✕ Remove</button>
      `;

      const btn = dom.querySelector('[data-delete-vp]') as HTMLButtonElement;
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos !== null && pos !== undefined) {
          editorInstance.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        }
      });

      return { dom };
    };
  },
});

// ─── ResizableImage Extension ────────────────────────────────
// Extends the built-in image to persist width/height attributes
const ResizableImage = TipTapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('width') || el.style.width?.replace('px', '') || null,
        renderHTML: attrs => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width:${attrs.width}px;max-width:100%;` };
        },
      },
      height: {
        default: null,
        parseHTML: el => el.getAttribute('height') || el.style.height?.replace('px', '') || null,
        renderHTML: attrs => {
          if (!attrs.height) return {};
          return { height: attrs.height, style: `height:${attrs.height}px;` };
        },
      },
    };
  },
});

// ─── Types ──────────────────────────────────────────────────
interface ModuleVideo {
  id: string;
  title: string;
  video_url: string;
  sort_order: number;
}

interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  moduleVideos?: ModuleVideo[]; // pass videos from parent
}

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

// ─── Upload Overlay ──────────────────────────────────────────
function UploadOverlay({ visible, label, progress }: { visible: boolean; label: string; progress: number }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.85)',
      zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 12,
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid rgba(255,42,85,0.3)',
        borderRadius: 14, padding: '28px 36px', textAlign: 'center', minWidth: 260,
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid rgba(255,42,85,0.25)',
          borderTop: '3px solid #FF2A55', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite', margin: '0 auto 14px',
        }} />
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>{label}</div>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(90deg,#FF2A55,#ff6b8a)',
            height: '100%', borderRadius: 99,
            width: `${progress}%`, transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 }}>{progress}%</div>
      </div>
    </div>
  );
}

// ─── Image Resize Popup ──────────────────────────────────────
function ImageResizePopup({
  visible, x, y, currentWidth, currentHeight, onApply, onClose
}: {
  visible: boolean; x: number; y: number;
  currentWidth: string; currentHeight: string;
  onApply: (w: string, h: string) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(currentWidth);
  const [h, setH] = useState(currentHeight);
  const [keepRatio, setKeepRatio] = useState(true);
  const origW = useRef(parseFloat(currentWidth) || 0);
  const origH = useRef(parseFloat(currentHeight) || 0);

  useEffect(() => {
    if (visible) {
      setW(currentWidth);
      setH(currentHeight);
      origW.current = parseFloat(currentWidth) || 0;
      origH.current = parseFloat(currentHeight) || 0;
    }
  }, [visible, currentWidth, currentHeight]);

  if (!visible) return null;

  const handleW = (val: string) => {
    setW(val);
    if (keepRatio && origW.current && origH.current) {
      const ratio = origH.current / origW.current;
      setH(Math.round(parseFloat(val) * ratio).toString());
    }
  };
  const handleH = (val: string) => {
    setH(val);
    if (keepRatio && origW.current && origH.current) {
      const ratio = origW.current / origH.current;
      setW(Math.round(parseFloat(val) * ratio).toString());
    }
  };

  const presets = [
    { label: '25%', w: Math.round(origW.current * 0.25) },
    { label: '50%', w: Math.round(origW.current * 0.5) },
    { label: '75%', w: Math.round(origW.current * 0.75) },
    { label: '100%', w: origW.current },
    { label: '400px', w: 400 },
    { label: '600px', w: 600 },
    { label: '800px', w: 800 },
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: Math.min(y, window.innerHeight - 320),
        left: Math.min(x, window.innerWidth - 300),
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        borderRadius: 12,
        padding: 16,
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        width: 280,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 14, color: '#0f172a' }}>🖼️ Resize Image</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8' }}>✕</button>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              const newW = p.w.toString();
              const newH = keepRatio && origW.current && origH.current
                ? Math.round(p.w * (origH.current / origW.current)).toString()
                : h;
              setW(newW);
              setH(newH);
            }}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
              background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569',
              fontWeight: 600,
            }}
          >{p.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>WIDTH (px)</label>
          <input
            type="number"
            value={w}
            onChange={e => handleW(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: 14, outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>HEIGHT (px)</label>
          <input
            type="number"
            value={h}
            onChange={e => handleH(e.target.value)}
            disabled={keepRatio}
            style={{
              width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: 14, outline: 'none',
              background: keepRatio ? '#f8fafc' : '#fff',
            }}
          />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={keepRatio}
          onChange={e => setKeepRatio(e.target.checked)}
          style={{ width: 15, height: 15 }}
        />
        <span style={{ fontSize: 12, color: '#475569' }}>Keep aspect ratio</span>
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: '1.5px solid #e2e8f0',
            background: 'transparent', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >Cancel</button>
        <button
          type="button"
          onClick={() => onApply(w, h)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: '#FF2A55', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          }}
        >Apply</button>
      </div>
    </div>
  );
}

// ─── Video Placeholder Picker Popup ─────────────────────────
function VideoPickerPopup({
  videos, onSelect, onClose
}: {
  videos: ModuleVideo[];
  onSelect: (v: ModuleVideo, idx: number) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: 44, left: 0, zIndex: 9999,
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      minWidth: 280, maxHeight: 320, overflow: 'auto',
      animation: 'fadeSlideIn 0.18s ease',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <strong style={{ fontSize: 13, color: '#0f172a' }}>📽️ Insert Video Placeholder</strong>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
          Choose which video to embed at cursor position
        </p>
      </div>
      {videos.length === 0 ? (
        <div style={{ padding: '20px 14px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
          No videos in this module yet.<br />Add videos from the sidebar first.
        </div>
      ) : (
        <div style={{ padding: '6px' }}>
          {videos.map((v, idx) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onSelect(v, idx); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: 'none', background: 'transparent',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,42,85,0.1)', color: '#FF2A55',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 12, flexShrink: 0,
              }}>{idx + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.title}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Click to insert at cursor</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#FF2A55', fontSize: 16 }}>+</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: 8, borderTop: '1px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', padding: '7px 0', border: '1px solid #e2e8f0',
            borderRadius: 8, background: 'transparent', color: '#64748b',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}
        >Close</button>
      </div>
    </div>
  );
}

// ─── Toolbar ────────────────────────────────────────────────
function EditorToolbar({
  editor, onImageUpload, onVideoUpload, uploading,
  moduleVideos, onInsertVideoPlaceholder,
}: {
  editor: Editor | null;
  onImageUpload: () => void;
  onVideoUpload: () => void;
  uploading: boolean;
  moduleVideos: ModuleVideo[];
  onInsertVideoPlaceholder: (v: ModuleVideo, idx: number) => void;
}) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);

  if (!editor) return null;

  function applyLink() {
    if (!linkUrl) { editor!.chain().focus().unsetLink().run(); return; }
    let href = linkUrl.trim();
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    editor!.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
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
        <label className="editor-tool-btn" title="Text color" style={{ cursor: 'pointer', position: 'relative', overflow: 'visible' }}>
          <span>🎨</span>
          <input
            type="color"
            style={{ position: 'absolute', opacity: 0, width: 24, height: 24, cursor: 'pointer' }}
            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <ToolBtn title="Remove color" onClick={() => editor.chain().focus().unsetColor().run()}>✕clr</ToolBtn>
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

      {/* Link — FIXED: opens popup and ensures https:// */}
      <div className="editor-tool-group" style={{ position: 'relative' }}>
        <ToolBtn title="Add / edit link" onClick={() => {
          const existing = editor.getAttributes('link').href || '';
          setLinkUrl(existing);
          setShowLink(v => !v);
        }} active={editor.isActive('link')}>🔗 Link</ToolBtn>
        <ToolBtn title="Remove link" onClick={() => { editor.chain().focus().unsetLink().run(); setShowLink(false); }}>🔗✕</ToolBtn>
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

      <div className="editor-tool-divider" />

      {/* Image + Video upload */}
      <div className="editor-tool-group">
        <ToolBtn title="Upload Image (Supabase)" onClick={onImageUpload} disabled={uploading}>
          {uploading ? '⏳' : '🖼️ Image'}
        </ToolBtn>
        <ToolBtn title="Upload Video to Bunny Stream" onClick={onVideoUpload} disabled={uploading}>
          {uploading ? '⏳' : '🎬 Upload'}
        </ToolBtn>
      </div>

      <div className="editor-tool-divider" />

      {/* 📽️ Insert Video Placeholder */}
      <div className="editor-tool-group" style={{ position: 'relative' }}>
        <ToolBtn
          title="Insert inline video placeholder at cursor"
          onClick={() => setShowVideoPicker(v => !v)}
          active={showVideoPicker}
        >
          📽️ Insert Video
        </ToolBtn>
        {showVideoPicker && (
          <VideoPickerPopup
            videos={moduleVideos}
            onSelect={onInsertVideoPlaceholder}
            onClose={() => setShowVideoPicker(false)}
          />
        )}
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
export default function BlockEditor({
  content, onChange, placeholder, readOnly = false, moduleVideos = [],
}: BlockEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Image resize state
  const [resizePopup, setResizePopup] = useState({
    visible: false, x: 0, y: 0,
    currentWidth: '', currentHeight: '',
    nodePos: -1,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      // FIXED: openOnClick: true so Ctrl/Cmd+click works; added HTMLAttributes
      Link.configure({
        openOnClick: false,        // we handle click manually below
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
          class: 'editor-link',
        },
      }),
      ResizableImage.configure({ HTMLAttributes: { class: 'editor-img' } }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing module content here…' }),
      VideoPlaceholderNode,
    ],
    content: content || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  // ── Handle link clicks in editor (Ctrl/Cmd+click) ──────────
  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!link) return;

      // Always open links in new tab when clicking in editor
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        window.open(link.href, '_blank', 'noopener,noreferrer');
        return;
      }

      // In edit mode, single click = select; prevent navigation
      if (!readOnly) {
        // show tooltip or do nothing — user can Ctrl+click to open
        return;
      }

      // In read-only mode, all clicks open the link
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    };

    editorDom.addEventListener('click', handleClick);
    return () => editorDom.removeEventListener('click', handleClick);
  }, [editor, readOnly]);

  // ── Handle image click → resize popup ──────────────────────
  useEffect(() => {
    if (!editor || readOnly) return;
    const editorDom = editor.view.dom;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'IMG') return;

      const img = target as HTMLImageElement;
      const rect = img.getBoundingClientRect();

      // Find node position
      let nodePos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          const dom = editor.view.nodeDOM(pos);
          if (dom === img || (dom as HTMLElement)?.contains?.(img)) {
            nodePos = pos;
            return false;
          }
        }
      });

      setResizePopup({
        visible: true,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 8,
        currentWidth: img.getAttribute('width') || String(img.naturalWidth || img.offsetWidth),
        currentHeight: img.getAttribute('height') || String(img.naturalHeight || img.offsetHeight),
        nodePos,
      });
    };

    editorDom.addEventListener('click', handleClick);
    return () => editorDom.removeEventListener('click', handleClick);
  }, [editor, readOnly]);

  const applyResize = useCallback((w: string, h: string) => {
    if (!editor || resizePopup.nodePos < 0) return;
    const node = editor.state.doc.nodeAt(resizePopup.nodePos);
    if (!node) return;

    editor.chain().focus().updateAttributes('image', {
      width: w ? parseInt(w) : null,
      height: h ? parseInt(h) : null,
    }).run();

    setResizePopup(p => ({ ...p, visible: false }));
    onChange(editor.getHTML());
  }, [editor, resizePopup.nodePos, onChange]);

  // ── Insert video placeholder at cursor ─────────────────────
  const insertVideoPlaceholder = useCallback((v: ModuleVideo, idx: number) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'videoPlaceholder',
      attrs: {
        videoId: v.id,
        videoTitle: v.title,
        videoIndex: idx,
      },
    }).run();
    onChange(editor.getHTML());
  }, [editor, onChange]);

  const triggerImageUpload = useCallback(() => imageInputRef.current?.click(), []);
  const triggerVideoUpload = useCallback(() => videoInputRef.current?.click(), []);

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

        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        setUploadProgress(80);

        const contentType = res.headers.get('content-type') || '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data.error = res.status === 413 ? 'Image too large. Max size 4.5MB.' : `Server error (${res.status})`;
        }

        if (!res.ok) {
          lastError = data.error || 'Image upload failed';
          if (res.status >= 500 && attempt < 1) { setUploadLabel('Retrying…'); continue; }
          setUploadError(lastError);
        } else {
          setUploadProgress(100);
          // Insert with a sensible default width (600px max)
          editor.chain().focus().setImage({
            src: data.url,
            alt: file.name,
          }).run();
          // After inserting, set width=600 by default to avoid huge images
          editor.chain().focus().updateAttributes('image', { width: 600 }).run();
          onChange(editor.getHTML());
          setUploadSuccess('✅ Image uploaded! Click it to resize.');
          setTimeout(() => setUploadSuccess(''), 4000);
          lastError = '';
        }
        break;
      } catch {
        lastError = attempt >= 1 ? 'Network error. Please try again.' : 'Network error. Retrying…';
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
    setUploadLabel(`Uploading "${file.name}" to Bunny Stream…`);
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
        const iframeHtml = `<div class="video-embed-block"><iframe src="${data.embedUrl}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:480px; border-radius:10px;"></iframe></div>`;
        editor.chain().focus().insertContent(iframeHtml).run();
        onChange(editor.getHTML());
        setUploadSuccess('✅ Video uploaded to Bunny Stream!');
        setTimeout(() => setUploadSuccess(''), 4000);
      }
    } catch {
      setUploadError('Network error uploading video.');
    }

    setUploading(false);
    setUploadProgress(0);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  // ── READ-ONLY render ──────────────────────────────────────
  if (readOnly) {
    // In read-only mode, render and make links clickable
    return (
      <div
        className="editor-readonly"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest('a[href]') as HTMLAnchorElement | null;
          if (link) {
            e.preventDefault();
            window.open(link.href, '_blank', 'noopener,noreferrer');
          }
        }}
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
    );
  }

  return (
    <>
      <div className="block-editor-wrap" style={{ position: 'relative' }}>
        <UploadOverlay visible={uploading} label={uploadLabel} progress={uploadProgress} />

        <EditorToolbar
          editor={editor}
          onImageUpload={triggerImageUpload}
          onVideoUpload={triggerVideoUpload}
          uploading={uploading}
          moduleVideos={moduleVideos}
          onInsertVideoPlaceholder={insertVideoPlaceholder}
        />

        <EditorContent editor={editor} className="editor-content-area" />

        {/* Hint bar */}
        <div style={{
          padding: '6px 14px', borderTop: '1px solid #f1f5f9',
          background: '#fafafa', fontSize: 11, color: '#94a3b8',
          display: 'flex', gap: 16,
        }}>
          <span>💡 Click any uploaded image to resize it</span>
          <span>·</span>
          <span>🔗 Ctrl+Click a link to open it</span>
          <span>·</span>
          <span>📽️ Use "Insert Video" to embed videos inline</span>
        </div>

        {/* Status messages */}
        {uploadError && (
          <div className="alert alert-error" style={{ margin: '8px 12px', fontSize: 13 }}>❌ {uploadError}</div>
        )}
        {uploadSuccess && (
          <div className="alert alert-success" style={{ margin: '8px 12px', fontSize: 13 }}>{uploadSuccess}</div>
        )}

        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
      </div>

      {/* Image resize popup — outside editor wrapper to avoid clipping */}
      <ImageResizePopup
        visible={resizePopup.visible}
        x={resizePopup.x}
        y={resizePopup.y}
        currentWidth={resizePopup.currentWidth}
        currentHeight={resizePopup.currentHeight}
        onApply={applyResize}
        onClose={() => setResizePopup(p => ({ ...p, visible: false }))}
      />

      {/* Inline styles for editor-link class & video placeholder */}
      <style>{`
        .editor-link {
          color: #1D4B73 !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }
        .editor-link:hover {
          color: #FF2A55 !important;
        }
        .editor-readonly a {
          color: #1D4B73;
          text-decoration: underline;
          cursor: pointer;
        }
        .editor-readonly a:hover {
          color: #FF2A55;
        }
        .editor-readonly .video-placeholder-block {
          display: flex;
          align-items: center;
          gap: 14px;
          background: linear-gradient(135deg, #0f172a, #1D4B73);
          border-radius: 12px;
          padding: 20px 24px;
          margin: 16px 0;
          border: 2px dashed rgba(255,42,85,0.4);
        }
        .ProseMirror img.editor-img {
          max-width: 100%;
          border-radius: 10px;
          margin: 12px 0;
          display: block;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          cursor: pointer;
          outline: 2px solid transparent;
          transition: outline 0.15s;
        }
        .ProseMirror img.editor-img:hover {
          outline: 2px solid #FF2A55;
        }
        .ProseMirror a {
          color: #1D4B73;
          text-decoration: underline;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          color: #FF2A55;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
