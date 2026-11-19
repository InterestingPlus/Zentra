import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Author, Book } from '../types/zentra';
import { extractGoogleDriveFileId } from '../utils/catalogLogic';

function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const clean = sanitizeWinAnsi(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `len-${buffer.byteLength}`;
}

export function verifyPdfMagicHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) return false;
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  return header === '%PDF-';
}

/**
 * Builds a genuine, richly typeset multi-page searchable PDF binary for a catalog book.
 * Used when the catalog book points to `zentra://...` or when an external demo URL cannot be fetched directly.
 */
export async function generateBookPdfBytes(book: Book, author?: Author): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create();
  const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const sansFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 64;
  const ink = rgb(0.11, 0.13, 0.17);
  const muted = rgb(0.4, 0.44, 0.5);
  const accent = rgb(0.12, 0.25, 0.55);

  const addFooter = (page: ReturnType<PDFDocument['addPage']>, pageNum: number) => {
    page.drawLine({
      start: { x: marginX, y: 54 },
      end: { x: pageWidth - marginX, y: 54 },
      thickness: 0.5,
      color: rgb(0.84, 0.86, 0.89),
    });
    page.drawText(sanitizeWinAnsi(book.title), {
      x: marginX,
      y: 38,
      size: 9,
      font: sansFont,
      color: muted,
    });
    page.drawText(`Page ${pageNum}`, {
      x: pageWidth - marginX - 38,
      y: 38,
      size: 9,
      font: sansFont,
      color: muted,
    });
  };

  // Page 1: Cover / Title Page
  const p1 = pdfDoc.addPage([pageWidth, pageHeight]);
  p1.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.985, 0.98, 0.965) });
  p1.drawRectangle({ x: marginX, y: pageHeight - 110, width: 48, height: 3, color: accent });
  p1.drawText(sanitizeWinAnsi(book.category.toUpperCase()), {
    x: marginX,
    y: pageHeight - 134,
    size: 10,
    font: sansFont,
    color: accent,
  });

  let y = pageHeight - 185;
  for (const line of wrapText(book.title, 26)) {
    p1.drawText(line, { x: marginX, y, size: 30, font: titleFont, color: ink });
    y -= 38;
  }
  if (book.subtitle) {
    y -= 8;
    for (const line of wrapText(book.subtitle, 46)) {
      p1.drawText(line, { x: marginX, y, size: 15, font: italicFont, color: muted });
      y -= 22;
    }
  }
  y -= 26;
  p1.drawText(`By ${sanitizeWinAnsi(author?.name ?? book.authorName ?? 'Zentra Author')}`, {
    x: marginX,
    y,
    size: 14,
    font: bodyFont,
    color: ink,
  });

  y -= 50;
  for (const line of wrapText(book.description, 62)) {
    p1.drawText(line, { x: marginX, y, size: 12, font: bodyFont, color: muted });
    y -= 18;
  }

  p1.drawText('Zentra Digital Library Edition', {
    x: marginX,
    y: 78,
    size: 10,
    font: sansFont,
    color: muted,
  });
  addFooter(p1, 1);

  // Page 2: Executive Summary & Key Takeaways
  const p2 = pdfDoc.addPage([pageWidth, pageHeight]);
  let y2 = pageHeight - 80;
  p2.drawText('Overview & Core Thesis', { x: marginX, y: y2, size: 20, font: titleFont, color: ink });
  y2 -= 32;
  for (const line of wrapText(book.summary || book.description, 68)) {
    p2.drawText(line, { x: marginX, y: y2, size: 12, font: bodyFont, color: ink });
    y2 -= 19;
  }
  y2 -= 24;
  p2.drawText('Key Takeaways', { x: marginX, y: y2, size: 16, font: titleFont, color: accent });
  y2 -= 26;
  for (const takeaway of book.keyTakeaways) {
    const lines = wrapText(`* ${takeaway}`, 64);
    for (const l of lines) {
      p2.drawText(l, { x: marginX, y: y2, size: 11.5, font: bodyFont, color: ink });
      y2 -= 18;
    }
    y2 -= 8;
  }
  addFooter(p2, 2);

  // Chapters (create rich multi-page content)
  const chapters =
    book.sampleChapters && book.sampleChapters.length > 0
      ? book.sampleChapters
      : [
          {
            title: 'Chapter 1: Foundations of Inquiry',
            paragraphs: [
              book.description,
              book.summary ||
                'Every enduring body of knowledge asks the reader to slow down, notice patterns across disciplines, and cultivate deliberate habits of reflection.',
              'By separating signal from background noise, we create room for sustained concentration. Ideas require stillness to take root in memory.',
            ],
          },
          {
            title: 'Chapter 2: Practice and Daily Rhythm',
            paragraphs: [
              'Consistent daily practice outperforms sporadic intensity. Even twenty uninterrupted minutes each morning reshapes how we think, decide, and remember over the course of a year.',
              'Use margins, highlights, and brief personal summaries to converse actively with the text rather than passively scanning lines.',
            ],
          },
          {
            title: 'Chapter 3: Synthesis in Everyday Life',
            paragraphs: [
              ...(book.practicalLessons ?? [
                'Review one saved insight each week and translate it into a concrete experiment.',
                'Return to foundational chapters whenever complexity clouds your judgment.',
              ]),
            ],
          },
        ];

  let pageCounter = 3;
  for (const chapter of chapters) {
    // Give each chapter 2 readable pages for genuine multi-page reading & double-page spreads
    const pageA = pdfDoc.addPage([pageWidth, pageHeight]);
    let yc = pageHeight - 80;
    pageA.drawText(sanitizeWinAnsi(chapter.title), {
      x: marginX,
      y: yc,
      size: 19,
      font: titleFont,
      color: ink,
    });
    yc -= 32;

    for (const para of chapter.paragraphs) {
      for (const line of wrapText(para, 66)) {
        if (yc < 100) break;
        pageA.drawText(line, { x: marginX, y: yc, size: 12, font: bodyFont, color: ink });
        yc -= 20;
      }
      yc -= 12;
    }
    addFooter(pageA, pageCounter++);

    const pageB = pdfDoc.addPage([pageWidth, pageHeight]);
    let yd = pageHeight - 80;
    pageB.drawText(`${sanitizeWinAnsi(chapter.title)} — Reflections`, {
      x: marginX,
      y: yd,
      size: 16,
      font: italicFont,
      color: accent,
    });
    yd -= 30;
    const reflectionParas = [
      'A careful reader pauses between arguments to ask: where does this principle apply in my own decisions today, and what assumptions must I examine before adopting it?',
      ...(book.importantQuotes?.map((q) => `"${q}"`) ?? [
        '"Clarity emerges when attention stays with one question long enough for distractions to fade."',
      ]),
      'Take a moment to highlight any passage on this page or attach a note in your Zentra Knowledge Hub so this idea stays retrievable months from now.',
    ];
    for (const para of reflectionParas) {
      for (const line of wrapText(para, 66)) {
        if (yd < 100) break;
        pageB.drawText(line, { x: marginX, y: yd, size: 12, font: bodyFont, color: ink });
        yd -= 20;
      }
      yd -= 14;
    }
    addFooter(pageB, pageCounter++);
  }

  // Final Page: Author Bio & Colophon
  const pLast = pdfDoc.addPage([pageWidth, pageHeight]);
  let yl = pageHeight - 90;
  pLast.drawText('About the Author', { x: marginX, y: yl, size: 19, font: titleFont, color: ink });
  yl -= 28;
  pLast.drawText(sanitizeWinAnsi(author?.name ?? book.authorName ?? 'Zentra Author'), {
    x: marginX,
    y: yl,
    size: 14,
    font: titleFont,
    color: accent,
  });
  yl -= 24;
  for (const line of wrapText(author?.bio ?? 'Author biography in Zentra catalog.', 66)) {
    pLast.drawText(line, { x: marginX, y: yl, size: 12, font: bodyFont, color: ink });
    yl -= 19;
  }
  if (author?.description) {
    yl -= 12;
    for (const line of wrapText(author.description, 66)) {
      pLast.drawText(line, { x: marginX, y: yl, size: 11.5, font: bodyFont, color: muted });
      yl -= 18;
    }
  }
  addFooter(pLast, pageCounter);

  const bytes = await pdfDoc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function getGoogleDriveFileIdForBook(book: Book): string | undefined {
  return book.pdfFileId || extractGoogleDriveFileId(book.pdfUrl) || extractGoogleDriveFileId(book.pdfReaderUrl);
}

export function isGoogleDrivePdf(book: Book): boolean {
  return Boolean(getGoogleDriveFileIdForBook(book));
}

export function getDrivePreviewUrl(book: Book): string | null {
  if (book.pdfReaderUrl && /^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/preview/i.test(book.pdfReaderUrl)) {
    return book.pdfReaderUrl;
  }
  const fileId = getGoogleDriveFileIdForBook(book);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : null;
}

export function getDriveDownloadUrl(book: Book): string | null {
  const fileId = getGoogleDriveFileIdForBook(book);
  return fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}` : null;
}

export async function importLocalPdfFile(file: File): Promise<ArrayBuffer> {
  const buffer = await file.arrayBuffer();
  if (!verifyPdfMagicHeader(buffer)) {
    throw new Error('Selected file is not a valid PDF document (%PDF- header missing).');
  }
  return buffer;
}

export async function fetchOrSynthesizePdf(
  book: Book,
  author: Author | undefined,
  options?: {
    signal?: AbortSignal;
    onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
    forceStudyEdition?: boolean;
  }
): Promise<ArrayBuffer> {
  const isDrive = isGoogleDrivePdf(book);
  const directFetchUrl =
    !options?.forceStudyEdition && !isDrive && /^https?:\/\//i.test(book.pdfUrl)
      ? book.pdfUrl
      : '';

  if (directFetchUrl) {
    const response = await fetch(directFetchUrl, { signal: options?.signal });
    if (!response.ok) {
      throw new Error(`Failed to load PDF (HTTP ${response.status})`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (!response.body) {
      const buf = await response.arrayBuffer();
      if (!verifyPdfMagicHeader(buf)) {
        throw new Error('Remote response did not return a valid PDF document.');
      }
      options?.onProgress?.(100, buf.byteLength, buf.byteLength);
      return buf;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        const total = contentLength > 0 ? contentLength : Math.max(received * 1.15, 1024);
        const pct = Math.min(98, Math.round((received / total) * 100));
        options?.onProgress?.(pct, received, contentLength || received);
      }
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    if (!verifyPdfMagicHeader(merged.buffer)) {
      throw new Error('Downloaded file did not contain a valid PDF header.');
    }
    options?.onProgress?.(100, received, received);
    return merged.buffer;
  }

  // Client-side Study Edition PDF (works 100% offline with zero backend server)
  options?.onProgress?.(20, 0, 100);
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await new Promise((r) => setTimeout(r, 120));
  options?.onProgress?.(55, 55, 100);
  const buffer = await generateBookPdfBytes(book, author);
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await new Promise((r) => setTimeout(r, 100));
  options?.onProgress?.(100, buffer.byteLength, buffer.byteLength);
  return buffer;
}
