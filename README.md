# Collect Filter

A Chrome DevTools panel extension that helps you find the network requests you care about by filtering on URL patterns and payload content using regex.

## The Problem

When navigating pages on sites like GitHub, dozens of POST requests hit analytics endpoints (e.g. `/collect`). Finding the specific request you're looking for means manually clicking through each one in the Network tab and inspecting its payload. This extension automates that.

## Features

- **URL pattern filter** — regex-based, defaults to `collect`
- **Payload regex filter** — matches against the raw JSON request body, with highlighted matches
- **Custom columns** — extract values from any JSON field in the payload and display them as columns in the request list (leaf-node lookup, ignores nesting)
- **Detail view** — click any request to see the full payload with syntax-highlighted JSON, request headers, or response body
- **Pause / Resume** — temporarily stop capturing new requests
- **Clear** — wipe all captured requests
- **Dark & light theme** — follows your system preference
- **Persistent columns** — custom column configuration is saved across sessions

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `collect-filter-extension` directory
5. Open DevTools on any page (F12 or Cmd+Opt+I)
6. Look for the **Collect Filter** tab

## Usage

### Filtering Requests

- **URL pattern**: Enter a regex in the URL pattern field to match request URLs (default: `collect`)
- **Payload regex**: Enter a regex to filter by request body content (e.g. `page_view|click`)
- Invalid regex patterns are highlighted with a red border

### Custom Columns

1. Type a JSON field name in the column input (e.g. `event_type`) and press **Enter**
2. The extension searches each request's JSON payload for a leaf node matching that field name (case-insensitive, ignores hierarchy)
3. The extracted value appears as a new column in the request list
4. Click **✕** on a column chip to remove it

### Detail View

Click any request row to open the detail overlay:
- **Payload** tab — pretty-printed, syntax-highlighted JSON with regex matches marked
- **Headers** tab — request headers
- **Response** tab — response body

Press **Escape** or click outside the panel to close.

## License

MIT
