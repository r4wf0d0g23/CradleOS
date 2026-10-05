CradleOS current-client icon pack — build 3573151

manifest.json: types[typeID].asset maps item IDs to local PNG paths. Null means unresolved.
ui: named shared UI symbols. library: Frontier-specific source-art library, not a live-item catalog.
Use separate type IDs even when image bytes are shared. Names are labels, never lookup keys.
Original pixels/dimensions retained; no fake upscaling. Load only needed PNGs.
provenance.json records exact source paths, hashes, dimensions and extraction inputs.
See NOTICE.txt for artwork attribution. No executables or credentials are included.
