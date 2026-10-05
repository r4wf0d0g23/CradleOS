# CradleOS Icon API v1

Base URL: **https://cradleos.io/api/icons**

Public, read-only, no account or API key. CORS permits browser clients from any
origin. GET, HEAD and OPTIONS only. The current release uses Stillness / Cycle 7
/ Vestiges / client build 3573151. Responses identify the build and world; a new
cycle may change the current snapshot. Save the returned content-addressed PNG
URL or download the versioned ZIP if you need a pinned reference.

## Search by name

    GET https://cradleos.io/api/icons?name=D1%20Fuel
    GET https://cradleos.io/api/icons?q=hydrocarbon
    GET https://cradleos.io/api/icons?q=reiver

`q` and `name` are aliases; supply only one. Search is case-insensitive,
accent-insensitive, trimmed, and collapses repeated whitespace. Space-separated
tokens must all match. Exact names/IDs rank before name-prefix and substring
matches. Duplicate names retain separate type IDs: never assume the first
Reiver result is the ship you intend. Prefer an exact type ID once selected.

Parameters:

- `q` or `name`: at most 128 characters; empty/omitted lists the collection.
- `collection`: `items` (default), `ui`, `library`, or `all`.
- `available`: optional `true`/`false`. **Image availability**, not gameplay availability.
- `limit`: whole number 1–100, default 25.
- `offset`: whole number 0–10000, default 0.

Pagination returns `total`, `limit`, `offset`, `nextOffset` (null at the end),
and `data`. No matches is 200 with an empty array. Bad, repeated, conflicting or
unknown parameters return 400 JSON, not silently altered queries.

## Exact item lookup

    GET https://cradleos.io/api/icons/88335
    GET https://cradleos.io/api/icons/88335/image

The first returns metadata under `data`; the second redirects (302) to the
original PNG. Unknown type IDs return 404. A known type with no native icon
returns metadata with `available: false`, `imageUrl: null`, and a reason. Its
`/image` endpoint returns 404 rather than presenting invented art. Lookup and
image endpoints do not accept query parameters.

Each entry includes `collection`, `key`, `typeId` (null for UI/library), `name`,
`available`, `imageUrl`, `lookupUrl`, `imageEndpoint`, `source`, `apiPublished`,
and `unavailableReason`. Non-item entries have null type lookup endpoints and
null API-publication status. Identity is `(collection, key)`, not name or image.
Images may legitimately be shared across distinct types.

## UI symbols and Frontier source art

    GET https://cradleos.io/api/icons?collection=ui&q=manufacturing
    GET https://cradleos.io/api/icons?collection=library&q=fuel&limit=50

`ui` and `library` names are readable resource-key labels, not localized gameplay
names. These collections are shipped art, not proof that an item or feature is
active. Search results supply direct PNG URLs; numeric lookup is for items only.

## Browser example

```js
const response = await fetch('https://cradleos.io/api/icons?name=D1%20Fuel');
if (!response.ok) throw new Error(`Icon search: ${response.status}`);
const result = await response.json();
const fuel = result.data.find(icon => icon.typeId === 88335);
if (fuel?.imageUrl) document.querySelector('#fuel-icon').src = fuel.imageUrl;
```

Or use the stable type lookup directly in HTML:

```html
<img src="https://cradleos.io/api/icons/88335/image" alt="D1 Fuel" width="32" height="32">
```

## Caching and errors

For server-side clients, send a descriptive `User-Agent`, such as
`MyFrontierApp/1.0`. The host's edge filtering blocks stock Python `urllib`
requests with HTTP 403 / code 1010 before they reach this API. Browser requests
and Python requests with a descriptive agent were verified. This does not
require an API key, and edge rejections are not the JSON errors described below.

```python
import json
from urllib.request import Request, urlopen

request = Request(
    "https://cradleos.io/api/icons?name=D1%20Fuel",
    headers={"User-Agent": "MyFrontierApp/1.0"},
)
with urlopen(request, timeout=15) as response:
    icons = json.load(response)
```

JSON responses include ETag; send If-None-Match to receive bodyless 304 when
unchanged. GET/HEAD JSON cache: browser 5 minutes, shared cache 1 hour. Numeric
image redirects cache 5 minutes. Content-hash PNGs cache immutably for a year.
`imageUrl` avoids the redirect for repeated use. CORS applies to API responses,
errors, redirects and PNGs; ETag is exposed to browser clients. No cookies needed.

Errors: `{ schemaVersion, cycle, cycleName, server, build, world, error: { code, message } }`.
400 invalid query; 404 missing endpoint/type/image; 405 unsupported method.
HEAD preserves GET status/headers with no response body. OPTIONS returns 204.

## Data, provenance, attribution

- [OpenAPI schema](https://cradleos.io/data/icon-api-v1.json)
- [Source manifest](https://cradleos.io/data/icons-cycle7-3573151/manifest.json)
- [Source hashes](https://cradleos.io/data/icons-cycle7-3573151/provenance.json)
- [Complete ZIP](https://cradleos.io/data/icons-cycle7-3573151/cradleos-icons-cycle7-3573151.zip)
- [Artwork notice](https://cradleos.io/data/icons-cycle7-3573151/NOTICE.txt)

EVE Frontier artwork © Fenris Creations; not relicensed under CradleOS's MIT code license.
