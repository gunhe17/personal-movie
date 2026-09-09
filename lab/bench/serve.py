import http.server, os, re
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path == '/progress':
            open('progress.log', 'ab').write(body + b'\n')
        else:
            name = self.path.strip('/').replace('/', '_') or 'result'
            open(name + '.json', 'wb').write(body)
        self.send_response(204); self.end_headers()

    def do_GET(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not (rng and os.path.isfile(path)):
            return super().do_GET()
        size = os.path.getsize(path)
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        a, b = m.group(1), m.group(2)
        start = int(a) if a else size - int(b)
        end = int(b) if (a and b) else size - 1
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        with open(path, 'rb') as f:
            f.seek(start); self.wfile.write(f.read(end - start + 1))

    def log_message(self, *a): pass

http.server.ThreadingHTTPServer.allow_reuse_address = True
http.server.ThreadingHTTPServer(('127.0.0.1', 8777), H).serve_forever()
