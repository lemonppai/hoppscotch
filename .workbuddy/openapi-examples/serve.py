"""
Serve the example OpenAPI documents in this folder over HTTP with CORS enabled,
so they can be imported into Hoppscotch via:

    http://localhost:3000/import?url=http://127.0.0.1:5050/user-center-v3.yaml&type=openapi

Usage (from the repo root, Python 3.7+):

    python .workbuddy/openapi-examples/serve.py            # port 5050
    python .workbuddy/openapi-examples/serve.py 5051       # custom port

Plain `python -m http.server` is not enough: browsers block the cross-origin
fetch (Hoppscotch runs on :3000, this server on :5050) unless the spec response
carries an Access-Control-Allow-Origin header.
"""

import functools
import http.server
import os
import socket
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    # Browsers do not care for the spec, but a sane type keeps devtools readable.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".yaml": "application/yaml",
        ".yml": "application/yaml",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    handler = functools.partial(CORSRequestHandler, directory=HERE)
    http.server.ThreadingHTTPServer.allow_reuse_address = True

    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        print("port %d is busy, try: python serve.py 5051" % port)
        raise SystemExit(1)

    hostname = socket.gethostname()
    print("serving %s" % HERE)
    for name in sorted(os.listdir(HERE)):
        if name.endswith((".yaml", ".yml", ".json")):
            print("  http://127.0.0.1:%d/%s" % (port, name))
    print()
    print(
        "import URL: http://localhost:3000/import?url="
        "http://127.0.0.1:%d/user-center-v3.yaml&type=openapi" % port
    )
    print("Ctrl+C to stop (%s)" % hostname)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
