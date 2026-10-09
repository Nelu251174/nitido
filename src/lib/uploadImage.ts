import sharp from 'sharp';

/** Decode pixel data, strip metadata and bound stored dimensions before marking a photograph VALID. */
export async function prepareUploadImage(input:Buffer):Promise<Buffer> {
 return sharp(input,{failOn:'warning',limitInputPixels:40_000_000})
  .rotate()
  .resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true})
  .toBuffer();
}
