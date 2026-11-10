import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const PDF_DOCUMENT_URL = 'docs/Turk-Soylenceler-Sozlugu-Deniz-Karakurt.pdf';
export const PDF_DOWNLOAD_FILENAME = 'Türk Söylenceler Sözlüğü - Deniz Karakurt.pdf';

class PdfBookCache {
  constructor() {
    this.pdfDoc = null;
    this.loadingPromise = null;
    this.pageDataUrls = new Map(); // pageNum (1-based) -> dataURL
    this.inFlight = new Map();
    this.maxCachedPages = 24;
  }

  async getDocument() {
    if (this.pdfDoc) return this.pdfDoc;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = pdfjsLib
      .getDocument({
        url: PDF_DOCUMENT_URL,
        cMapPacked: true,
        disableAutoFetch: true,
        disableStream: false,
      })
      .promise.then((doc) => {
        this.pdfDoc = doc;
        return doc;
      })
      .catch((err) => {
        this.loadingPromise = null;
        throw err;
      });

    return this.loadingPromise;
  }

  getCachedPage(pageNumber1Based) {
    if (!this.pageDataUrls.has(pageNumber1Based)) return null;
    const val = this.pageDataUrls.get(pageNumber1Based);
    // Refresh LRU order
    this.pageDataUrls.delete(pageNumber1Based);
    this.pageDataUrls.set(pageNumber1Based, val);
    return val;
  }

  async renderPage(pageNumber1Based, scale = 1.65) {
    const cached = this.getCachedPage(pageNumber1Based);
    if (cached) return cached;

    if (this.inFlight.has(pageNumber1Based)) {
      return this.inFlight.get(pageNumber1Based);
    }

    const job = (async () => {
      const doc = await this.getDocument();
      if (pageNumber1Based < 1 || pageNumber1Based > doc.numPages) {
        return null;
      }
      const page = await doc.getPage(pageNumber1Based);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      page.cleanup();

      // Evict oldest if over capacity
      if (this.pageDataUrls.size >= this.maxCachedPages) {
        const oldestKey = this.pageDataUrls.keys().next().value;
        this.pageDataUrls.delete(oldestKey);
      }
      this.pageDataUrls.set(pageNumber1Based, dataUrl);
      return dataUrl;
    })().finally(() => {
      this.inFlight.delete(pageNumber1Based);
    });

    this.inFlight.set(pageNumber1Based, job);
    return job;
  }

  prefetchAround(pageNumber1Based, totalPages) {
    const targets = [pageNumber1Based + 1, pageNumber1Based - 1, pageNumber1Based + 2];
    for (const p of targets) {
      if (p >= 1 && p <= totalPages && !this.pageDataUrls.has(p) && !this.inFlight.has(p)) {
        this.renderPage(p).catch(() => {});
      }
    }
  }
}

export const pdfCache = new PdfBookCache();
