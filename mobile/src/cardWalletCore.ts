export type WalletCard={id:string;brand:string|null;last4:string|null;expMonth:number|null;expYear:number|null;isDefault:boolean};
export type Wallet={hasCard:boolean;stripeConfigured:boolean;maxCards:number;cards:WalletCard[]};
export function selectAvailableCard(cards:WalletCard[],selected?:string|null){return cards.find(c=>c.id===selected)?.id??cards.find(c=>c.isDefault)?.id??cards[0]?.id??null;}
export function checkoutTarget(value:{url?:string;sessionId?:string}) {
 const url=new URL(value.url??"");
 if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com"||url.username||url.password||!/^cs_[a-zA-Z0-9_]{1,240}$/.test(value.sessionId??""))throw Error("Formularul de card nu este disponibil momentan.");
 return {url:url.href,sessionId:value.sessionId!};
}
