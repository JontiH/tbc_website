// The one upcoming event. Drives /events and the site-wide sticker.
// For the next event: replace the poster files in public/ and edit this file.
export const event = {
  // Keys the sticker dismissal in sessionStorage; a new id shows it again.
  id: "lip-balm-2026",
  kind: "workshop",
  title: "Beeswax Lip and Hand Balm Workshop",
  blurb: "Make beeswax balms with the club and take them home. Great for gifts.",
  description: "Take home two lip balms and one hand balm.",

  // UTC. Dec 5, 2026 2 pm to 4 pm Toronto is EST (UTC-5).
  start: "2026-12-05T19:00:00Z",
  end: "2026-12-05T21:00:00Z",
  dateLabel: "Saturday, December 5, 2026",
  timeLabel: "2 pm \u2013 4 pm",

  venue: "Carrot Common",
  address: "348 Danforth Ave, Room 212",
  directions: "The door for Room 212 is on the west side of Book City.",
  mapsQuery: "Carrot Common, 348 Danforth Ave, Toronto, ON",

  price: "$25 per person",
  // Extra rows in the details card, after When, Where and Cost.
  extras: [{ label: "You take home", value: "Two lip balms and one hand balm" }],
  registerUrl: "https://bit.ly/4iwKLMg",
  email: "torontobeekeeperscollective@gmail.com",
  emailSubject: "Lip and hand balm workshop",

  poster: {
    src: "/lip-balm-workshop-poster.webp",
    // JPEG for link previews; some scrapers skip webp.
    ogSrc: "https://torontobeekeeping.ca/lip-balm-workshop-og.jpg",
    width: 1122,
    height: 1402,
    alt:
      "Poster for the Toronto Beekeepers Collective beeswax lip and hand balm workshop. " +
      "Great for gifts! Take home two lip balms and one hand balm. " +
      "Carrot Common, 348 Danforth, Room 212. Saturday, December 5, 2026, 2 pm to 4 pm. " +
      "$25 per person. Register by QR code or email torontobeekeeperscollective@gmail.com.",
  },

  sticker: {
    kicker: "Upcoming",
    title: "Lip balm workshop",
    date: "Dec 5",
    // Dec 6 00:00 Toronto (EST, UTC-5).
    expires: "2026-12-06T05:00:00Z",
  },
};
