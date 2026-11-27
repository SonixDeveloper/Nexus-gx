# NEXUS GX download page

Serve this directory with any static HTTP server. For local testing run `python3 -m http.server 8080 --directory site` from the project root and visit `http://localhost:8080`.

After verifying packages, stage the authentic binaries under `site/downloads/` and list their exact filenames in `downloads.json`. An installer link appears only when the file is explicitly listed and the host serves it successfully. The build workflow uploads preview artifacts to CI and does not publish this site.

Add a real desktop screenshot captured during release verification before publishing.
