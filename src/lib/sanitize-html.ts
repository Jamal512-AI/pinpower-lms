const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
const SAFE_DATA_IMAGE_PREFIX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

function isSafeUrl(value: string) {
  try {
    const parsed = new URL(value, 'https://pinpower.local');
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Lightweight client-side sanitizer for rich-text HTML from TipTap.
 * Removes script-like elements and unsafe URL/event attributes.
 */
export function sanitizeHtml(html: string) {
  if (!html) return '';
  if (typeof window === 'undefined') {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('script, style, iframe[src^="javascript:"], object, embed, form').forEach((el) => {
    el.remove();
  });

  const nodes = doc.body.querySelectorAll('*');
  nodes.forEach((node) => {
    const element = node as HTMLElement;
    const attrs = [...element.attributes];

    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        return;
      }

      if (name === 'src' || name === 'href') {
        const isDataImage = name === 'src' && SAFE_DATA_IMAGE_PREFIX.test(value);
        if (!isDataImage && !isSafeUrl(value)) {
          element.removeAttribute(attr.name);
        }
      }
    });
  });

  return doc.body.innerHTML;
}
