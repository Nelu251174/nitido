import React from 'react';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const alt = 'NITIDO.RO — Curățenie în România';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Local approved fonts cover Romanian glyphs without Google's fallback fetch.
const inter = readFileSync(join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff'));
const interExtended = readFileSync(join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff'));

// Shared brand image: no request data, provider promises or demonstration metrics.
export default function OgImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: '#F7F3EC', fontFamily: 'Inter, Inter Extended' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', padding: 52, background: '#FFFFFF', border: '1px solid #DED8CE', borderRadius: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 48, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ color: '#111827' }}>NITIDO</span>
          <span style={{ color: '#009E60' }}>.RO</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 82, fontWeight: 700, lineHeight: 1.12, letterSpacing: -3 }}>
          <span style={{ color: '#111827' }}>Curățenie fără</span>
          <span style={{ color: '#009E60' }}>complicații.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, borderTop: '1px solid #DED8CE', fontSize: 26, color: '#52616A' }}>
          <span>Servicii de curățenie în România</span>
          <span style={{ color: '#007A4A', fontWeight: 700 }}>nitido.ro</span>
        </div>
      </div>
    </div>,
    { ...size, fonts: [
      { name: 'Inter', data: inter, weight: 700, style: 'normal' },
      { name: 'Inter Extended', data: interExtended, weight: 700, style: 'normal' },
    ] },
  );
}
