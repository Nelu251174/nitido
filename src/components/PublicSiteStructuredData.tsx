import {getLocale} from 'next-intl/server';
/** Public brand identity; no fabricated ratings, prices or local addresses. */
export async function PublicSiteStructuredData(){
 const locale=await getLocale();
 const data={"@context":"https://schema.org","@graph":[
  {"@type":"Organization","@id":"https://nitido.ro/#organization",name:"NITIDO.RO",url:"https://nitido.ro/",logo:"https://nitido.ro/icons/icon-512x512.png",email:"support@nitido.ro"},
  {"@type":"WebSite","@id":"https://nitido.ro/#website",url:"https://nitido.ro/",name:"NITIDO.RO",inLanguage:locale,publisher:{"@id":"https://nitido.ro/#organization"}}
 ]};
 return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,"\\u003c")}}/>;
}
