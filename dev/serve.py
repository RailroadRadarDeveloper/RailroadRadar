"""Serve a RailroadRadar checkout with every page pointed at the local Firebase emulators.

Usage: python3 dev/serve.py [site folder] [--port 8090]
"""
import argparse
import http.server
import os
import re

DEV_DIR = os.path.dirname(os.path.abspath(__file__))
INJECT = b'<script src="/__dev/emulator.js"></script>'
DEV_FILES = {'/__dev/emulator.js': 'emulator.js', '/__dev/users.json': 'users.json'}


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path in DEV_FILES:
            return self.send_file(os.path.join(DEV_DIR, DEV_FILES[path]))
        fs_path = self.translate_path(self.path)
        if os.path.isdir(fs_path):
            if not path.endswith('/'):
                return super().do_GET()
            fs_path = os.path.join(fs_path, 'index.html')
        if fs_path.endswith('.html') and os.path.isfile(fs_path):
            return self.send_file(fs_path)
        return super().do_GET()

    def send_file(self, fs_path):
        with open(fs_path, 'rb') as f:
            body = f.read()
        ctype = self.guess_type(fs_path)
        if ctype == 'text/html':
            # First thing in <head>, so it runs before any page script loads Firebase.
            body = re.sub(rb'<head[^>]*>', lambda m: m.group(0) + INJECT, body, count=1, flags=re.I)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root', nargs='?', default=os.path.dirname(DEV_DIR))
    ap.add_argument('--port', type=int, default=8090)
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    handler = lambda *a, **kw: Handler(*a, directory=root, **kw)
    print('Serving %s with the local test database at http://localhost:%d' % (root, args.port))
    http.server.ThreadingHTTPServer(('', args.port), handler).serve_forever()


if __name__ == '__main__':
    main()
