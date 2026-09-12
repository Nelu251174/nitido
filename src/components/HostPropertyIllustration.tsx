/** Displays the photographic region of the approved board, without changing the source asset.
 * The surrounding demo names, addresses and badges are excluded from the viewport.
 */
export function HostPropertyIllustration({variant}:{variant:number}){
 const regions=['300 263 245 148','711 263 243 148','1122 263 243 148'];
 return <svg className="host-property-illustration" viewBox={regions[variant%regions.length]} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="/design-v2/host-approved-reference.png" width="1536" height="1024"/></svg>;
}
