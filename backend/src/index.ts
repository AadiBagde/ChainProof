import { config } from './config.js';
import { connectMongo } from './db.js';
import { createApp } from './app.js';

async function startServer() {
  try {
    await connectMongo();
    console.log(`[Database] Connected to MongoDB database: ${config.dbName}`);

    const app = createApp();
    app.listen(config.port, () => {
      console.log(`[Server] ChainProof backend running on http://127.0.0.1:${config.port}`);
      console.log(`[Blockchain] RPC Target: ${config.rpcUrl} (Chain ID: ${config.chainId})`);
      console.log(
        '[Auth] Case sessions use short-lived JWTs in the Authorization header (local demo; not HttpOnly cookies).'
      );
    });
  } catch (err) {
    console.error('[Startup Error] Failed to initialize server:', (err as Error).message);
    process.exit(1);
  }
}

startServer();
