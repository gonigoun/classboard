# 시험용 서버: 파일을 보여 주고, 가짜 저장소(/mock/...)의 데이터를 메모리에 들고 있어요.
# 사용법: python3 tests/mockserver.py 8765  → http://localhost:8765/?mock
import json, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DB = {'v': 0, 'data': {}}
LOCK = threading.Lock()

class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.startswith('/mock/state'):
            since = int(self.path.split('since=')[-1]) if 'since=' in self.path else -1
            with LOCK:
                return self._json({'v': DB['v'], 'data': DB['data'] if since != DB['v'] else {}} if since != DB['v'] else {'v': DB['v']})
        if self.path.startswith('/mock/reset'):
            with LOCK:
                DB['data'] = {}; DB['v'] += 1
            return self._json({'ok': True})
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith('/mock/commit'):
            n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n))
            with LOCK:
                d = DB['data']
                for o in body['ops']:
                    if o['op'] == 'del': d.pop(o['path'], None)
                    elif o.get('merge') and o['path'] in d: d[o['path']] = {**d[o['path']], **o['data']}
                    else: d[o['path']] = o['data']
                DB['v'] += 1
            return self._json({'ok': True, 'v': DB['v']})
        self.send_error(404)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
