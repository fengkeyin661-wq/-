
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
    plugins: [react(), deepseekApiDevPlugin(env)],
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
