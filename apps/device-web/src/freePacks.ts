export type FreePackTrack = {
  title: string;
  artist: string;
  source: string;
  sourceUrl: string;
  license: "Public Domain" | "CC0" | "CC BY";
  licenseNote: string;
};

export type FreeMusicPack = {
  id: string;
  title: string;
  mood: string;
  description: string;
  runtime: string;
  sources: string[];
  tracks: FreePackTrack[];
};

const musopen = "https://musopen.org/music/";
const fmaPublicDomain = "https://freemusicarchive.org/search?adv=1&music-filter-public-domain=1";
const citizenDj = "https://citizen-dj.labs.loc.gov/";
const archive78 = "https://archive.org/details/78rpm";
const archiveNetlabels = "https://archive.org/details/netlabels";

export const freeMusicPacks: FreeMusicPack[] = [
  {
    id: "morning-mist",
    title: "Morning Mist",
    mood: "Soft piano, strings, and early-light archive recordings",
    description: "A low-friction first-play pack for waking up, stretching, writing, and making the room feel awake without rushing it.",
    runtime: "about 42 min",
    sources: ["Musopen public-domain classical recordings", "Free Music Archive public-domain search", "Library of Congress Citizen DJ"],
    tracks: [
      track("Gymnopedie No. 1", "Erik Satie", "Musopen", musopen, "Public Domain", "Verify recording license on Musopen before mirroring audio."),
      track("Prelude in C Major, BWV 846", "Johann Sebastian Bach", "Musopen", musopen, "Public Domain", "Public-domain composition; recording license should be checked per file."),
      track("Morning Mood", "Edvard Grieg", "Musopen", musopen, "Public Domain", "Use a Musopen public-domain recording."),
      track("Clair de Lune", "Claude Debussy", "Musopen", musopen, "Public Domain", "Use a public-domain or CC0 performance."),
      track("Ave Maria", "Franz Schubert", "Musopen", musopen, "Public Domain", "Prefer instrumental public-domain recordings for broad reuse."),
      track("Nocturne Op. 9 No. 2", "Frederic Chopin", "Musopen", musopen, "Public Domain", "Confirm the selected performance is public domain."),
      track("The Swan", "Camille Saint-Saens", "Musopen", musopen, "Public Domain", "Composition is public domain; recording rights vary."),
      track("Spring Field", "Hina", "Free Music Archive", fmaPublicDomain, "CC0", "Use only the CC0/public-domain result and preserve source metadata."),
      track("Library Bells", "Library of Congress", "Citizen DJ", citizenDj, "Public Domain", "Citizen DJ collections are free-to-use; retain collection attribution."),
      track("Early Window", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "Public Domain", "Choose from the public-domain filtered archive results.")
    ]
  },
  {
    id: "cooking-music",
    title: "Cooking Music",
    mood: "Warm jazz age, folk, light dance records, and kitchen-tempo instrumentals",
    description: "A livelier pack for chopping, simmering, setting the table, and keeping the house moving.",
    runtime: "about 35 min",
    sources: ["Internet Archive 78 RPM collection", "Free Music Archive public-domain search", "Citizen DJ"],
    tracks: [
      track("Maple Leaf Rag", "Scott Joplin archive performance", "Internet Archive 78 RPM", archive78, "Public Domain", "Use a public-domain recording first published in the eligible period."),
      track("The Entertainer", "Scott Joplin archive performance", "Internet Archive 78 RPM", archive78, "Public Domain", "Check both composition and recording status before mirroring."),
      track("Charleston rhythm selection", "Public Domain 78 RPM orchestra", "Internet Archive 78 RPM", archive78, "Public Domain", "Pick a pre-cutoff recording with clear archive metadata."),
      track("Sweet Georgia Brown selection", "Public Domain 78 RPM band", "Internet Archive 78 RPM", archive78, "Public Domain", "Use only recordings with public-domain status for the recording."),
      track("Kitchen Foxtrot", "Public Domain 78 RPM orchestra", "Internet Archive 78 RPM", archive78, "Public Domain", "Archive 78 labels vary; verify each item page."),
      track("Sunny Side ragtime piano", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "Public Domain", "Select from public-domain filtered results."),
      track("Pantry Swing", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "Public Domain", "Avoid NonCommercial and NoDerivatives licenses."),
      track("Market Street", "Library of Congress", "Citizen DJ", citizenDj, "Public Domain", "Free-to-use sound material; preserve source collection details."),
      track("Stove Light", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "CC0", "Use CC0/public-domain recordings where no credit is required."),
      track("Dinner Bell", "Library of Congress", "Citizen DJ", citizenDj, "Public Domain", "Use a public-domain Citizen DJ sample or recording.")
    ]
  },
  {
    id: "coding-music",
    title: "Coding Music",
    mood: "Minimal, ambient, netlabel, and focus-friendly instrumentals",
    description: "A steady instrumental queue for deep work that does not fight your attention.",
    runtime: "about 48 min",
    sources: ["Internet Archive Netlabels", "Free Music Archive public-domain and CC BY search", "Citizen DJ"],
    tracks: [
      track("Soft Loop 01", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC BY", "Credit required; verify the item-level license before bundling."),
      track("Terminal Rain", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC BY", "Use only commercial-compatible Creative Commons licenses."),
      track("Low Contrast", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC BY", "Avoid NC-licensed netlabel releases."),
      track("Quiet Compiler", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC BY", "Retain artist, label, and license in the pack manifest."),
      track("Green Cursor", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC0", "Prefer CC0 tracks for frictionless reuse."),
      track("Long Focus", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "Public Domain", "Select a public-domain instrumental recording."),
      track("Small Hours", "Public Domain archive selection", "Free Music Archive", fmaPublicDomain, "CC0", "Use CC0/public-domain search filters."),
      track("Machine Room Tone", "Library of Congress", "Citizen DJ", citizenDj, "Public Domain", "Citizen DJ sound materials can support ambient beds."),
      track("Cold Boot", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC BY", "Credit line travels with downloaded manifest."),
      track("Commit Window", "Open netlabel artist", "Internet Archive Netlabels", archiveNetlabels, "CC0", "Confirm file license and direct asset URL before mirroring.")
    ]
  },
  {
    id: "classical-relaxation",
    title: "Classical Relaxation",
    mood: "Slow strings, piano, nocturnes, and unfussy orchestral pieces",
    description: "A calm classical pack for reading, evening decompression, study breaks, and quiet rooms.",
    runtime: "about 55 min",
    sources: ["Musopen public-domain recordings", "Internet Archive Musopen mirror"],
    tracks: [
      track("Air on the G String", "Johann Sebastian Bach", musopen, musopen, "Public Domain", "Select a public-domain recording."),
      track("Canon in D", "Johann Pachelbel", musopen, musopen, "Public Domain", "Confirm recording rights even when the composition is public domain."),
      track("Piano Sonata No. 14, Moonlight: I. Adagio sostenuto", "Ludwig van Beethoven", musopen, musopen, "Public Domain", "Use a public-domain performance."),
      track("Pavane, Op. 50", "Gabriel Faure", musopen, musopen, "Public Domain", "Check item-level performance license."),
      track("Swan Lake: Scene", "Pyotr Ilyich Tchaikovsky", musopen, musopen, "Public Domain", "Use a clearly licensed recording."),
      track("Peer Gynt Suite No. 1: Aase's Death", "Edvard Grieg", musopen, musopen, "Public Domain", "Prefer Musopen public-domain performances."),
      track("String Quartet slow movement", "Joseph Haydn", musopen, musopen, "Public Domain", "Confirm performer and recording license."),
      track("Nocturne in E-flat Major", "Frederic Chopin", musopen, musopen, "Public Domain", "Use public-domain/CC0 performance metadata."),
      track("Vltava quiet excerpt", "Bedrich Smetana", musopen, musopen, "Public Domain", "Archive mirrors need per-file verification."),
      track("Meditation", "Jules Massenet", musopen, musopen, "Public Domain", "Confirm recording rights before in-app audio hosting.")
    ]
  }
];

function track(
  title: string,
  artist: string,
  source: string,
  sourceUrl: string,
  license: FreePackTrack["license"],
  licenseNote: string
): FreePackTrack {
  return { title, artist, source, sourceUrl, license, licenseNote };
}
