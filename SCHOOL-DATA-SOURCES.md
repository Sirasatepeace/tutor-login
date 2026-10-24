# School name suggestions

The signup form and the owner's account creation form share a school combobox.
The browser lazily downloads the static name/location directory when the field
is first focused, caches it for the page, and matches the spelling typed by the
user. Queries are processed locally; typing does not send a search request to a
third-party service. The field still accepts a school missing from the list.
Selecting a suggestion stores `school name (province)` in the existing school
profile field. Existing profiles are not changed.

## Sources and scope

The snapshot was prepared on 21 October 2026. Its metadata and source-file
SHA-256 hashes are included in `public/data/thai-schools-20261021.json`.

| Publisher | Source date | Dataset |
| --- | --- | --- |
| Office of the Basic Education Commission (OBEC) | 10 June 2026, semester 2569/1 | [Official DMC school directory](https://web2.bopp.go.th/?page_id=878) |
| Department of Local Administration (DLA) | 20 May 2026 | [Local-government schools](https://gdcatalog.go.th/dataset/gdpublish-school9) |
| Office of the Permanent Secretary, Ministry of Education | 2015 (2558) | [Nationwide education institution directory](https://data.go.th/th/dataset/item_8548e3ab-00bf-4eae-b29a-156a4aa52c0d) |

Attribution: school names and locations are derived from those publishers'
official public datasets. DLA's catalogue labels its licence “Open Data Common”.
The ministry catalogue labels its licence “Creative Commons Attributions”.
The OBEC source is its public DMC statistical download; no additional licence
claim is made here.

The ministry's historical register supplements private schools, Bangkok schools,
demonstration schools, Buddhist schools, border patrol schools, other school
sectors, and vocational institutions. Its old OBEC and local-government records
are replaced by the 2026 datasets. Universities, non-formal community centres,
and unrelated higher-education institutions are excluded. Exact name/location
duplicates and repeated school codes are merged, preferring the newer input.

The directory spans all 77 provinces. It is **not a verified current register of
every operating school**: some sectors use 2015 data, and new, renamed or closed
schools may differ. The combobox deliberately permits free text. No live registry
connection or automatic refresh is implied.

Only names, school codes, provinces and districts are published. Source contact
details, pupil statistics and coordinates are not included.

## Rebuild

Download the three official resource URLs listed in the JSON metadata into a
temporary directory, using the listed filenames. With Python and `openpyxl`:

```sh
python scripts/build-school-directory.py /absolute/path/to/downloads
node --test tests/school-search.test.mjs
```

For a new snapshot, update the source dates, input layouts, generated date and
output filename in the script, and the asset URL in
`app/school-autocomplete.tsx`. Review coverage before publication. Keep the raw
source workbooks outside the repository and deployment.
