
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { forwardDeepSeekChatCompletions } from './lib/deepseekForward';

function readRequestBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function xlmsIngestDevPlugin(): Plugin {
  return {
    name: 'xlms-ingest-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/api/xlms/synced' && req.method === 'GET') {
          try {
            const checkupId = new URL(req.url || '', 'http://127.0.0.1').searchParams.get('checkupId') || '';
            const mod = await server.ssrLoadModule('/services/xlmsSyncStatus.ts');
            const result = await mod.listSyncedExamMarks(checkupId);
            res.statusCode = Number(result.httpStatus) || 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error('[xlms synced]', error);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, ok: false, message: error instanceof Error ? error.message : '读取已同步年份失败' }));
          }
          return;
        }
        if (pathname !== '/api/xlms/ingest' || req.method !== 'POST') {
          next();
          return;
        }
        try {
          const address = server.httpServer?.address();
          const port = address && typeof address === 'object' ? address.port : 5173;
          (globalThis as { __HEALTH_GUARD_ORIGIN?: string }).__HEALTH_GUARD_ORIGIN = `http://127.0.0.1:${port}`;
          const bodyText = await readRequestBody(req);
          if (!bodyText || bodyText.length > 200_000) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, ok: false, message: '请求过大' }));
            return;
          }
          const mod = await server.ssrLoadModule('/services/xlmsIngest.ts');
          const result = await mod.ingestStructuredVisit(JSON.parse(bodyText));
          res.statusCode = Number(result.httpStatus) || 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('[xlms ingest]', error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: false,
            ok: false,
            message: error instanceof Error ? error.message : '同步失败',
          }));
        }
      });
    },
  };
}

function deepseekApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'deepseek-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];

        if (pathname === '/api/deepseek/status') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ configured: Boolean(env.DEEPSEEK_API_KEY?.trim()) }));
          return;
        }

        if (pathname === '/api/deepseek/chat/completions' && req.method === 'POST') {
          const apiKey = env.DEEPSEEK_API_KEY?.trim();
          if (!apiKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Set DEEPSEEK_API_KEY in .env for local dev' }));
            return;
          }
          try {
            const bodyText = await readRequestBody(req);
            const upstream = await forwardDeepSeekChatCompletions(apiKey, bodyText);
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              'Content-Type',
              upstream.headers.get('content-type') || 'application/json',
            );
            res.end(text);
          } catch (e) {
            console.error('[deepseek dev proxy]', e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'DeepSeek upstream failed' }));
          }
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), deepseekApiDevPlugin(env), xlmsIngestDevPlugin()],
    server: {
      proxy: {
        '/api/baichuan': {
          target: 'https://api.baichuan-ai.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/baichuan/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
