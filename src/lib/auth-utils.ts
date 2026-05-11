import { createClient } from './supabase';

/**
 * Forcefully clears all Supabase-related data from the browser.
 * This includes cookies and localStorage.
 */
export async function forceLogout() {
  const supabase = createClient();
  
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('SignOut error:', e);
  }

  // 1. Clear all cookies starting with 'sb-'
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith("sb-")) {
        const name = cookie.split("=")[0];
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
        // Also try clearing with domain variations if necessary
        document.cookie = `${name}=; Path=/; Domain=${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      }
    }
  }

  // 2. Clear localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    Object.keys(window.localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        window.localStorage.removeItem(key);
      }
    });
  }

  // 3. Clear session storage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    Object.keys(window.sessionStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        window.sessionStorage.removeItem(key);
      }
    });
  }
}
