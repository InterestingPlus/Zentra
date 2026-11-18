import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,80}$/;

function startsWithPdfMagic(chunk: Uint8Array): boolean {
  if (chunk.byteLength < 5) return false;
  return (
    chunk[0] === 0x25 && // %
    chunk[1] === 0x50 && // P
    chunk[2] === 0x44 && // D
    chunk[3] === 0x46 && // F
    chunk[4] === 0x2d // -
  );
}

function extractDriveConfirmUrl(html: string): string | null {
  const formMatch = html.match(/<form[^>]*id=["']download-form["'][^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch) {
    const action = formMatch[1].replace(/&amp;/g, '&');
    const body = formMatch[2];
    const params = new URLSearchParams();
    const inputRe = /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(body)) !== null) {
      params.set(m[1], m[2]);
    }
    if (params.toString()) {
      return `${action}${action.includes('?') ? '&' : '?'}${params.toString()}`;
    }
  }
  const hrefMatch = html.match(/href=["'](\/uc\?export=download[^"']+)["']/i);
  if (hrefMatch) {
    return `https://drive.google.com${hrefMatch[1].replace(/&amp;/g, '&')}`;
  }
  return null;
}

async function fetchDriveStream(
  fileId: string,
  signal: AbortSignal
): Promise<globalThis.Response> {
  const initialUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; ZentraLibrary/1.0)',
    Accept: 'application/pdf,application/octet-stream,*/*',
  };

  let upstream = await fetch(initialUrl, {
    method: 'GET',
    redirect: 'follow',
    headers,
    signal,
  });

  const ct = (upstream.headers.get('content-type') ?? '').toLowerCase();
  if (upstream.ok && ct.includes('text/html')) {
    const html = await upstream.text();
    const confirmUrl = extractDriveConfirmUrl(html);
    if (!confirmUrl) {
      throw new Error('Google Drive returned an HTML confirmation or access page instead of a PDF.');
    }
    upstream = await fetch(confirmUrl, {
      method: 'GET',
      redirect: 'follow',
      headers,
      signal,
    });
  }

  return upstream;
}

async function handlePdfProxy(req: Request, res: Response): Promise<void> {
  const rawFileId = typeof req.query.fileId === 'string' ? req.query.fileId.trim() : '';
  if (!DRIVE_FILE_ID_RE.test(rawFileId)) {
    res.status(400).json({ error: 'Invalid or missing Google Drive fileId parameter.' });
    return;
  }

  const abortController = new AbortController();
  const onClientClose = () => {
    abortController.abort();
  };
  res.on('close', onClientClose);

  try {
    const upstream = await fetchDriveStream(rawFileId, abortController.signal);
    if (!upstream.ok) {
      res.status(502).json({
        error: `Google Drive returned HTTP ${upstream.status} for file ${rawFileId}.`,
      });
      return;
    }

    if (!upstream.body) {
      const buf = new Uint8Array(await upstream.arrayBuffer());
      if (!startsWithPdfMagic(buf)) {
        res.status(422).json({ error: 'Upstream file is not a valid PDF binary.' });
        return;
      }
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buf.byteLength));
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(Buffer.from(buf));
      return;
    }

    const reader = upstream.body.getReader();
    let headerBuffer = new Uint8Array(0);

    // Accumulate enough leading bytes to verify the %PDF- magic header before streaming
    while (headerBuffer.byteLength < 8) {
      const { done, value } = await reader.read();
      if (value && value.byteLength > 0) {
        const next = new Uint8Array(headerBuffer.byteLength + value.byteLength);
        next.set(headerBuffer, 0);
        next.set(value, headerBuffer.byteLength);
        headerBuffer = next;
      }
      if (done) break;
    }

    if (!startsWithPdfMagic(headerBuffer)) {
      await reader.cancel().catch(() => {});
      res.status(422).json({
        error: 'Google Drive response did not start with a %PDF- header (file may be private or restricted).',
      });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && /^\d+$/.test(contentLength)) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.write(Buffer.from(headerBuffer));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0 && !res.writableEnded) {
        const canContinue = res.write(Buffer.from(value));
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err) {
    if (abortController.signal.aborted || res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to stream PDF from upstream source.',
    });
  } finally {
    res.off('close', onClientClose);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/pdf-proxy', (req, res) => {
    void handlePdfProxy(req, res);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Zentra server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
