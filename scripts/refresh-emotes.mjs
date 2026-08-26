// Vendors the 7TV emotes used as page decoration into public/img/emotes and
// writes data/emotes.json. Plain Node, no dependencies — same shape as
// refresh-data.mjs.
//
//   node scripts/refresh-emotes.mjs
//
// The app makes zero network calls at runtime (the future Twitch extension CSP
// forbids outside origins), so every emote has to be on disk before build.
// After changing this list, update EMOTES in src/components/emotes.ts to match:
// emotes.test.ts cross-checks the two and will fail if they drift.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const OUT = new URL('../public/img/emotes/', import.meta.url);
const MANIFEST = new URL('../data/emotes.json', import.meta.url);

/**
 * `role` is documentation only — it records where each emote is used:
 *   scatter  strewn around the page (EmoteScatter)
 *   cluster  the huddles of three, two and two singles
 *   stinger  full-screen one-shots (Stinger)
 *   pinned   fixed to a specific bit of UI
 */
const EMOTES = [
  ['01GDVH0WFG000A0NVRJES4XKQG', 'gigagnome', 'scatter'],
  ['01HDWCKQ38000E90E28ZX303JB', 'gnomborger', 'scatter'],
  ['01KYQ55207VY85PC1YXH89XAVN', 'gnome-wide', 'scatter'],
  ['01JC2FK9951KXJ04F0V78XWRXJ', 'gnome-punch', 'scatter'],
  ['01GJPV50K0000AQETVA6HTMKFG', 'vvgnome', 'scatter'],
  ['01GTQKRJ5800046QN9890Q93QY', 'gnome-campfire', 'scatter'],
  ['01FF8DFHER000D76QJKE5PX6S7', 'peepo-sit-business', 'scatter'],
  ['01GD5B6A8R000E0RPNH2V9ZDK0', 'ba-batchest', 'scatter'],
  ['01G48N41C8000EG77XRC690WYS', 'gm-to-gms-only', 'scatter'],
  ['01GG1BTTRR0005FR5X2SW95ZHT', 'protect-from-billy-bob', 'scatter'],
  ['01GTCZS7FR0004J62EZBADK03V', 'mods', 'scatter'],
  ['01J607DK5R00026B027ATG12HC', 'strawberry', 'scatter'],
  ['01HC0K8DN800010Z57ZSET2NT1', 'ahmadmuhsin', 'cluster'],
  ['01GZTBKF8G0009XMNFG77T591W', 'tiltedgnome', 'stinger'],
  ['01H27GJ4500005AYDEKRM0GD1S', 'shocked', 'stinger'],
  ['01G3WEGZN0000ET2J0MQP5YJ0G', 'gamba', 'stinger'],
  ['01H4YQ4A4R0008E4ZC9RD77HA2', 'hardmode', 'pinned'],
  ['01HCM59WYG0009XR48886X5FM3', 'roulette', 'pinned'],
];

/** Scattered trim only ever scales UP (<=250%), so its source has to stay small
 *  enough that the natural size sits at or below the rendered size. */
const MAX_TRIM_WIDTH = 128;
/** Keeps one heavily-animated emote from dominating the page weight. */
const MAX_TRIM_BYTES = 500_000;

const api = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const manifest = [];
let total = 0;

for (const [id, slug, role] of EMOTES) {
  const meta = await (await api(`https://7tv.io/v3/emotes/${id}`)).json();
  // Animated WebP plays in a plain <img> in every modern browser, at a fraction
  // of the GIF's weight.
  const webp = meta.host.files.filter((f) => f.format === 'WEBP').sort((a, b) => b.width - a.width);
  // A stinger fills the screen, so it takes the largest file there is.
  const pick =
    role === 'stinger'
      ? webp[0]
      : (webp.find((f) => f.width <= MAX_TRIM_WIDTH && f.size <= MAX_TRIM_BYTES) ?? webp.at(-1));

  const file = `${slug}.webp`;
  const bytes = Buffer.from(await (await api(`https:${meta.host.url}/${pick.name}`)).arrayBuffer());
  writeFileSync(new URL(file, OUT), bytes);
  total += bytes.length;

  manifest.push({
    id,
    role,
    name: meta.name,
    file,
    width: pick.width,
    height: pick.height,
    animated: meta.animated,
    author: meta.owner?.display_name ?? meta.owner?.username ?? null,
    kb: Math.round(bytes.length / 1024),
  });

  const m = manifest.at(-1);
  console.log(
    `${m.name.slice(0, 22).padEnd(23)} ${file.padEnd(26)} ${pick.name} ` +
      `${String(m.width).padStart(3)}x${String(m.height).padEnd(3)} ${m.animated ? 'anim ' : 'still'} ` +
      `${String(m.kb).padStart(4)}kb ${m.role.padEnd(7)} by ${m.author}`,
  );
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.length} emotes, ${Math.round(total / 1024)}kb total -> public/img/emotes`);
