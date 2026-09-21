/**
 * Shared hardening helpers for every html2canvas-pro capture in the app
 * (result certificates, hall tickets, registration receipts). Centralized
 * here so the fix for the "PDF sometimes renders unstyled" bug lives in one
 * place instead of being copy-pasted per generator.
 *
 * Root causes fixed:
 * 1. Fonts (Bebas Neue / Nunito) load via a lazy `media="print"` swap trick
 *    in index.html for page-speed, so `document.fonts.ready` alone can
 *    resolve before they've actually been fetched — the browser then paints
 *    (and html2canvas captures) a fallback system font.
 * 2. html2canvas-pro clones our <link rel="stylesheet"> tags as-is into a
 *    fresh, blank iframe document, which makes the browser issue a brand-new
 *    fetch for that CSS file. Its internal render pipeline only awaits
 *    document.fonts.ready and (on WebKit) images — it never waits for that
 *    re-fetched stylesheet to actually apply. Most of the time the disk
 *    cache makes the fetch resolve instantly and nobody notices, but it is a
 *    genuine race: when it loses (slower disk/network, cache revalidation,
 *    low-end mobile), html2canvas rasterizes the clone with zero Tailwind
 *    styling applied — only literal inline `style={{}}` props survive,
 *    producing an unstyled, unstructured PDF. This is why it only happened
 *    "sometimes".
 */

/** Forces the app's web fonts to finish downloading before a capture starts. */
export async function ensureAppFontsLoaded(): Promise<void> {
  const specs = [
    '400 16px "Bebas Neue"',
    '400 16px "Nunito"', '500 16px "Nunito"', '600 16px "Nunito"',
    '700 16px "Nunito"', '800 16px "Nunito"', '900 16px "Nunito"',
  ];
  await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => {})));
  await document.fonts.ready;
}

/**
 * Waits for every stylesheet link in an html2canvas `onclone` document to
 * finish loading before html2canvas is allowed to proceed (it awaits
 * onclone's returned promise). Closes the stylesheet race described above.
 */
export function waitForClonedStylesheets(clonedDoc: Document): Promise<void> {
  const links = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  return Promise.all(
    links.map((link) => {
      if (link.sheet) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        // Safety net so a broken/blocked stylesheet can never hang the capture.
        setTimeout(done, 3000);
      });
    })
  ).then(() => undefined);
}
