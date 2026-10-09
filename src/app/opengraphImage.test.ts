import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import OgImage, { alt, contentType, size } from './opengraph-image';

afterEach(() => vi.unstubAllGlobals());

it('renders a real shareable PNG at the declared dimensions without a network dependency', async () => {
  const network = vi.fn(async (input: unknown) => { throw new Error(`Social image must render offline: ${String(input)}`); });
  vi.stubGlobal('fetch', network);
  const response = OgImage();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(contentType);
  const png = Buffer.from(await response.arrayBuffer());
  const image = await sharp(png).metadata();
  expect(image).toMatchObject({ format: 'png', width: size.width, height: size.height });
  expect(image.width).toBe(1200);
  expect(image.height).toBe(630);
  expect(png.byteLength).toBeLessThan(5 * 1024 * 1024);
  expect(alt).toContain('NITIDO.RO');
  expect(network.mock.calls.every(([target]) => !/^https?:/i.test(String(target)))).toBe(true);
  if (process.env.NITIDO_QA_OG_PREVIEW) await writeFile(process.env.NITIDO_QA_OG_PREVIEW, png);
});
