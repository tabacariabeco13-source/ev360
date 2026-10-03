import crypto from 'crypto';

export function parseStripeSignature(header=''){
  const parts=String(header).split(',').map(x=>x.trim()).filter(Boolean);
  const out={t:null,v1:[]};
  for(const part of parts){
    const [k,v]=part.split('=');
    if(k==='t') out.t=Number(v);
    if(k==='v1'&&v) out.v1.push(v);
  }
  return out;
}

export function stripeExpectedSignature({payload,timestamp,secret}){
  return crypto.createHmac('sha256',String(secret)).update(String(timestamp)+'.'+payload).digest('hex');
}

function safeHexEqual(a,b){
  if(!a||!b) return false;
  const aa=Buffer.from(String(a),'hex');
  const bb=Buffer.from(String(b),'hex');
  if(!aa.length||aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

export function verifyStripeWebhook({rawBody,signatureHeader,secret,toleranceSeconds=300,nowSeconds=Math.floor(Date.now()/1000)}){
  if(!secret) return {ok:false,error:'WEBHOOK_SECRET_NOT_CONFIGURED'};
  const parsed=parseStripeSignature(signatureHeader);
  if(!parsed.t||!parsed.v1.length) return {ok:false,error:'INVALID_STRIPE_SIGNATURE_HEADER'};
  const age=Math.abs(Number(nowSeconds)-Number(parsed.t));
  if(age>toleranceSeconds) return {ok:false,error:'STRIPE_SIGNATURE_TIMESTAMP_OUTSIDE_TOLERANCE',age};
  const payload=Buffer.isBuffer(rawBody)?rawBody.toString('utf8'):String(rawBody||'');
  const expected=stripeExpectedSignature({payload,timestamp:parsed.t,secret});
  const ok=parsed.v1.some(sig=>safeHexEqual(sig,expected));
  return ok?{ok:true,timestamp:parsed.t}:{ok:false,error:'STRIPE_SIGNATURE_MISMATCH'};
}

export function stripePaymentFromEvent(event={}){
  const type=String(event.type||'');
  const obj=event.data?.object||{};
  const supported=new Set(['checkout.session.completed','payment_intent.succeeded','invoice.paid']);
  if(!supported.has(type)) return {supported:false,type};
  const metadata=obj.metadata||{};
  const engagement_id=metadata.engagement_id||metadata.engagementId||null;
  const cents=Number(obj.amount_total??obj.amount_received??obj.amount_paid??0);
  return {
    supported:true,
    type,
    event_id:event.id||null,
    engagement_id,
    provider_reference:obj.payment_intent||obj.id||event.id||null,
    amount_received_usd:Number((Math.max(0,cents)/100).toFixed(2)),
    currency:String(obj.currency||'usd').toUpperCase()
  };
}
