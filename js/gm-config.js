// The Game Master passcode, stored only as its SHA-256 hash (the passcode itself is never in the code). To change it,
// put the hash of a new passcode here: in a browser console, run
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('your new passcode')).then((b) => console.log([...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')))
export const GM_CONFIG = { hash: 'caa9050e07430d805763ed7b83bccc61f11a43a8806d7123a61e68a8f2780896' };
