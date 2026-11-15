"""Local static server for the 3D viewer (offline). Binds to 127.0.0.1 only and forces correct JS MIME types
(Windows registry overrides can make Python serve .js as text/plain, which breaks ES modules).
Usage: python tools/serve.py [port] [--no-open]
"""
import http.server
import socketserver
import sys
import os
import webbrowser
import functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(next((a for a in sys.argv[1:] if a.isdigit()), 8765))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
        '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=ROOT)
    with Server(('127.0.0.1', PORT), handler) as httpd:
        url = f'http://127.0.0.1:{PORT}/'
        print(f'Serving {ROOT} at {url}  (Ctrl+C to stop)')
        if '--no-open' not in sys.argv:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
