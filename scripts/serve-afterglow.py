"""Serve reviewed static Afterglow bytes; never executes console code."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.appcache': 'text/cache-manifest',
                      '.bin': 'application/octet-stream'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--directory', default=str(Path(__file__).resolve().parent))
    args = parser.parse_args()
    server = ThreadingHTTPServer(('0.0.0.0', args.port), partial(Handler, directory=args.directory))
    print(f'Static host on port {args.port}. Open its LAN address on PS4.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
