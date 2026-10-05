#!/usr/bin/env node
// One-time setup of the booth Cloudinary cloud: uploads the templates and fonts and creates the
// named transformations. Safe to re-run: uploads overwrite, transformations are updated in place.
//
//   export CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>   (never commit it)
//   npm install
//   node setup-booth-cloud.mjs --dry-run      # prints what it would do, no network
//   node setup-booth-cloud.mjs                # uploads + creates the transformations
//   node setup-booth-cloud.mjs --sample       # also uploads the sample selfie and saves test renders to ./out
//
// Run from templates/cloudinary-setup/. Reads ../cloudinary/*.png, ./fonts/*.ttf, ../_source/sample-selfie-maya.jpg.
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES, visitorUrls } from './recipes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(HERE, '..');
const DRY = process.argv.includes('--dry-run');
const SAMPLE = process.argv.includes('--sample');

if (!DRY && !process.env.CLOUDINARY_URL) {
  console.error('Set CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud> first (or use --dry-run).');
  process.exit(1);
}
const cloud = DRY ? (process.env.CLOUDINARY_URL?.split('@')[1] || '<booth-cloud>') : cloudinary.config().cloud_name;
const log = (...a) => console.log(DRY ? '[dry-run]' : '', ...a);

async function uploadTemplates() {
  const dir = path.join(TEMPLATES, 'cloudinary');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    const public_id = `booth/templates/${f.replace(/\.png$/, '')}`;
    log('upload', f, '->', public_id);
    if (DRY) continue;
    await cloudinary.uploader.upload(path.join(dir, f), {
      public_id, asset_folder: 'booth/templates', overwrite: true, invalidate: true, unique_filename: false, tags: ['booth-template'],
    });
  }
  return files.length;
}

async function uploadFonts() {
  const dir = path.join(HERE, 'fonts');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.ttf'))) {
    const public_id = `booth/fonts/${f}`; // raw assets keep the extension in the public ID
    log('upload font', f, '->', public_id, '(raw, authenticated)');
    if (DRY) continue;
    await cloudinary.uploader.upload(path.join(dir, f), {
      resource_type: 'raw', type: 'authenticated', public_id, asset_folder: 'booth/fonts', overwrite: true, invalidate: true,
    });
  }
}

async function upsertTransformations() {
  for (const [name, str] of Object.entries(RECIPES)) {
    // The API takes the bare name; URLs add the t_ prefix (created as "tv_hero", used as t_tv_hero).
    const id = name.replace(/^t_/, '');
    log('named transformation', id, '=', str);
    if (DRY) continue;
    try {
      await cloudinary.api.create_transformation(id, str);
      console.log('  created', id);
    } catch (e) {
      const msg = e?.error?.message || e?.message || String(e);
      if (!/already exists/i.test(msg)) throw e;
      await cloudinary.api.update_transformation(id, { unsafe_update: str });
      console.log('  updated', id);
    }
  }
}

async function sample() {
  const publicId = 'booth/visitors/maya-sol-sample';
  log('upload sample selfie ->', publicId);
  if (!DRY) {
    await cloudinary.uploader.upload(path.join(TEMPLATES, '_source', 'sample-selfie-maya.jpg'), {
      public_id: publicId, asset_folder: 'booth/visitors', overwrite: true, faces: true, tags: ['booth-sample'],
    });
  }
  const cases = [
    { firstName: 'Maya', favorite: 'Artichoke', productType: 'pizza', variant: 'artichoke', tag: 'maya' },
    { firstName: 'Maximiliano', favorite: "Nonna's Secret Fig", productType: 'gelato', variant: 'own-answer', tag: 'long' },
    { firstName: 'Alessandra', favorite: 'Doppio, con panna', productType: 'caffe', variant: 'own-answer', tag: 'comma' },
  ];
  fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
  for (const c of cases) {
    const urls = visitorUrls({ cloud, publicId, ...c });
    for (const [kind, url] of Object.entries(urls)) {
      log(c.tag, kind, url);
      if (DRY) continue;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  ${kind}: HTTP ${res.status} ${res.headers.get('x-cld-error') || ''}`);
        continue;
      }
      const ext = (res.headers.get('content-type') || '').split('/')[1] || 'png';
      fs.writeFileSync(path.join(HERE, 'out', `${c.tag}-${kind}.${ext}`), Buffer.from(await res.arrayBuffer()));
      console.log(`  ${kind}: saved out/${c.tag}-${kind}.${ext}`);
    }
  }
}

const n = await uploadTemplates();
await uploadFonts();
await upsertTransformations();
if (SAMPLE) await sample();
console.log(`\nDone on cloud "${cloud}": ${n} template images, 2 fonts, ${Object.keys(RECIPES).length} named transformations.`);
if (SAMPLE) console.log('Compare out/*.png with ../proofs/ and cloudinary-setup/previews/ at 100%.');
