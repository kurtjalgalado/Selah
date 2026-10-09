// Polyfills + globals for tests (Node + jsdom + fake-indexeddb)
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
        window.matchMedia = () => ({
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
        });
    }
    if (!window.scrollTo) window.scrollTo = () => {};
}
