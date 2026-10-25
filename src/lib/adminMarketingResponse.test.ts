import {describe,it,expect} from 'vitest';
import {readMarketingResponse} from './adminMarketingResponse';
describe('Marketing API response recovery',()=>{
 it('replaces a temporary proxy response with a useful message and accepts a later valid response',async()=>{
  await expect(readMarketingResponse(new Response('no available server',{status:503}))).rejects.toThrow('Serverul este temporar indisponibil');
  await expect(readMarketingResponse(new Response('<html>unavailable</html>',{status:502}))).rejects.toThrow('Pagina va reîncerca automat');
  await expect(readMarketingResponse(Response.json({counties:[]}))).resolves.toEqual({counties:[]});
 });
 it('preserves the existing API authorization errors',async()=>{
  await expect(readMarketingResponse(Response.json({error:'Acces rezervat administratorului.'},{status:401}))).rejects.toThrow('Acces rezervat administratorului.');
 });
});
