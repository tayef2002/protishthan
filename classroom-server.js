/**
 * Protishthan Classroom Relay Server
 * Receives WebM chunks from teacher's browser → FFmpeg → YouTube RTMP
 *
 * Run: node classroom-server.js
 * Requires: npm install ws   |   ffmpeg in system PATH
 */

const http    = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;

// Map: sessionId → { ffmpeg, ws, startedAt }
const activeStreams = new Map();

// ─── HTTP server (health check) ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      active: activeStreams.size,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ─── WebSocket server ───────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let ffmpeg    = null;
  let sessionId = null;
  let streaming = false;

  console.log('[WS] Teacher connected');

  ws.on('message', (raw, isBinary) => {
    // ── Binary: video/audio chunk from MediaRecorder ──
    if (isBinary) {
      if (ffmpeg && ffmpeg.stdin.writable && streaming) {
        ffmpeg.stdin.write(raw);
      }
      return;
    }

    // ── JSON control messages ──
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {

      // ── Start RTMP stream ────────────────────────────────────────────────
      case 'start': {
        if (streaming) { send(ws, { type: 'error', msg: 'Already streaming' }); return; }

        sessionId = msg.sessionId || ('s_' + Date.now());
        const rtmp      = msg.rtmpUrl;      // rtmp://a.rtmp.youtube.com/live2/XXXX
        const videoBr   = msg.videoBr  || '2500k';
        const audioBr   = msg.audioBr  || '128k';
        const fps       = msg.fps       || 30;

        if (!rtmp) { send(ws, { type: 'error', msg: 'rtmpUrl required' }); return; }

        console.log(`[Stream:${sessionId}] Starting → ${rtmp}`);

        ffmpeg = spawn('ffmpeg', [
          '-loglevel', 'warning',
          '-re',
          // Input: webm stream from browser stdin
          '-i', 'pipe:0',
          // ── Video ──
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-tune', 'zerolatency',
          '-b:v', videoBr,
          '-maxrate', videoBr,
          '-bufsize', (parseInt(videoBr) * 2) + 'k',
          '-pix_fmt', 'yuv420p',
          '-r', String(fps),
          '-g', String(fps * 2),   // keyframe every 2s
          '-keyint_min', String(fps),
          // ── Audio ──
          '-c:a', 'aac',
          '-b:a', audioBr,
          '-ar', '44100',
          '-ac', '2',
          // ── Output ──
          '-f', 'flv',
          rtmp
        ]);

        ffmpeg.stdin.on('error', () => {}); // suppress broken-pipe

        ffmpeg.stderr.on('data', d => {
          const line = d.toString().trim();
          if (line) process.stdout.write('[FFmpeg] ' + line + '\n');
        });

        ffmpeg.on('close', code => {
          console.log(`[Stream:${sessionId}] FFmpeg exited (${code})`);
          streaming = false;
          activeStreams.delete(sessionId);
          send(ws, { type: 'ended', code });
        });

        ffmpeg.on('error', err => {
          console.error('[FFmpeg] Spawn error:', err.message);
          send(ws, { type: 'error', msg: 'FFmpeg not found. Install ffmpeg and add to PATH.' });
        });

        streaming = true;
        activeStreams.set(sessionId, { ffmpeg, ws, startedAt: Date.now() });
        send(ws, { type: 'ready', sessionId });
        break;
      }

      // ── Stop stream ──────────────────────────────────────────────────────
      case 'stop': {
        stopStream('teacher requested');
        break;
      }
    }
  });

  ws.on('close', () => stopStream('ws closed'));
  ws.on('error', ()  => stopStream('ws error'));

  function stopStream(reason) {
    if (!ffmpeg) return;
    console.log(`[Stream:${sessionId}] Stopping (${reason})`);
    streaming = false;
    try {
      ffmpeg.stdin.end();
      setTimeout(() => { try { ffmpeg.kill('SIGKILL'); } catch {} }, 3000);
    } catch {}
    ffmpeg = null;
    if (sessionId) activeStreams.delete(sessionId);
    send(ws, { type: 'stopped' });
  }
});

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║  Protishthan Classroom Relay Server  ║');
  console.log(`  ║  Listening on http://localhost:${PORT}  ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log('  Requires: ffmpeg installed in system PATH');
  console.log('  Install:  winget install ffmpeg  (Windows)');
  console.log('            brew install ffmpeg    (Mac)');
  console.log('            apt install ffmpeg     (Ubuntu)');
  console.log('');
});
