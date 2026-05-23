import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import axios from 'axios';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use CORS middleware for all routes
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
  }));

  // Add a simple health check BEFORE the proxy
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // Diagnostic endpoint to verify direct connectivity from server to target
  app.get('/api/proxy-check', async (req, res) => {
    try {
      const response = await axios.get('https://statslc.leosaquetto.com/api/group', { timeout: 10000 });
      res.json({ 
        status: 'ok', 
        targetAlive: true, 
        responseTime: response.headers['date'],
        dataSummary: response.data ? 'received' : 'empty'
      });
    } catch (err: any) {
      res.status(502).json({ 
        status: 'error', 
        targetAlive: false, 
        message: err.message,
        code: err.code
      });
    }
  });

  // Proxy API requests to avoid CORS issues
  app.use('/api', createProxyMiddleware({
    target: 'https://statslc.leosaquetto.com/api',
    changeOrigin: true,
    secure: true,
    timeout: 30000,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Ensure Host header is set correctly for HTTPS target
        proxyReq.setHeader('Host', 'statslc.leosaquetto.com');
        const fullPath = (req as any).originalUrl || req.url;
        console.log(`[Proxy Request] ${req.method} ${fullPath} -> https://statslc.leosaquetto.com/api${req.url}`);
      },
      proxyRes: (proxyRes, req, res) => {
        const fullPath = (req as any).originalUrl || req.url;
        console.log(`[Proxy Response] ${proxyRes.statusCode} for ${fullPath} (Content-Type: ${proxyRes.headers['content-type']})`);
        
        // Remove existing CORS headers from target to avoid duplicates
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
      },
      error: (err, req, res) => {
        const fullPath = (req as any).originalUrl || req.url;
        console.error(`[Proxy Error] for ${fullPath}:`, err.message);
        if (res && 'status' in res) {
          (res as any).status(502).json({ error: 'Proxy Error', message: err.message, path: fullPath });
        }
      }
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
