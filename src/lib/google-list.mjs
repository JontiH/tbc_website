/**
 * Build-time fetcher for a public Google Maps saved list
 * (https://www.google.com/local/userlists/list/<id>).
 *
 * Google has no official API for saved lists, but the public list page
 * server-renders all of its data inside an `AF_initDataCallback({key: 'ds:0',
 * ... data: [...]})` script blob. This module fetches the page, extracts that
 * blob, and pulls out the list title, description, and places (name, note,
 * lat, lng, city).
 *
 * Because this is an internal Google format it may change without notice.
 * Every extraction step validates what it finds and THROWS on surprise, so a
 * format change fails the site build loudly (CI goes red, the live site keeps
 * the last successfully-built data) instead of silently publishing an empty
 * map.
 *
 * Known blob shape (as of 2026-08):
 *   data[0][2]      list title        "Honey Pop Up Sale Summer 2026"
 *   data[0][3]      list description
 *   data[0][5]      array of places, each:
 *     place[1]      name              "7 Yarmouth Rd"
 *     place[2]      note              "10 am - 1 pm - near Dupont and Christie"
 *     place[10]     latitude          43.6702497
 *     place[11]     longitude         -79.4191407
 *     place[12]     city              "Toronto, ON"
 */

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function fail(msg) {
  throw new Error(
    `google-list: ${msg}. Google may have changed the saved-list page format; ` +
      `see src/lib/google-list.mjs for the expected structure.`
  );
}

/**
 * Fetch and parse a public Google saved list.
 * @param {string} listId e.g. "kcH4Wyo-TLaHMs4gCsL3NQ"
 * @returns {Promise<{title: string, description: string, places: Array<{name: string, note: string, lat: number, lng: number, city: string}>}>}
 */
export async function fetchGoogleList(listId) {
  const url = `https://www.google.com/local/userlists/list/${listId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });
  if (!res.ok) fail(`fetch of ${url} returned HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(
    /AF_initDataCallback\(\{key: 'ds:0'.*?data:(.*?), sideChannel/s
  );
  if (!m) fail("could not find the ds:0 AF_initDataCallback data blob");

  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    fail("ds:0 data blob is not valid JSON");
  }

  const root = data?.[0];
  if (!Array.isArray(root)) fail("data[0] is not an array");

  const title = root[2];
  const description = root[3];
  if (typeof title !== "string" || title.length === 0)
    fail("list title (data[0][2]) is not a non-empty string");

  const rawPlaces = root[5];
  if (!Array.isArray(rawPlaces) || rawPlaces.length === 0)
    fail("places array (data[0][5]) is missing or empty");

  const places = rawPlaces.map((p, i) => {
    if (!Array.isArray(p)) fail(`place ${i} is not an array`);
    const [name, note, lat, lng, city] = [p[1], p[2], p[10], p[11], p[12]];
    if (typeof name !== "string" || name.length === 0)
      fail(`place ${i} has no name at index 1`);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      fail(`place ${i} ("${name}") has non-numeric lat/lng at indexes 10/11`);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
      fail(`place ${i} ("${name}") has out-of-range coordinates ${lat},${lng}`);
    return {
      name,
      note: typeof note === "string" ? note : "",
      lat,
      lng,
      city: typeof city === "string" ? city : "",
    };
  });

  return {
    title,
    description: typeof description === "string" ? description : "",
    places,
  };
}
