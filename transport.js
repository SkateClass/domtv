import {uid,redact} from './core.js';import {get,set,NS} from './storage.js';
export const instance=uid();const role=document.body.dataset.role;
let config=get('connection',{url:'',cloud:false}),session=get('session.'+role,''),inflight=Promise.resolve();
export function connection(){return {...config,authenticated:!!session}}
export function configure(url,cloud){if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))throw Error('Нужен URL Apps Script /exec');if(url!==config.url){session='';set('session.'+role,'')}config={url,cloud};set('connection',config)}
export function jsonp(q){return new Promise((resolve,reject)=>{const cb='efir2_'+uid().replace(/-/g,''),script=document.createElement('script');let timeout;const done=(error,data)=>{clearTimeout(timeout);script.remove();window[cb]=()=>{};setTimeout(()=>delete window[cb],60000);error?reject(Error(redact(error))):resolve(data)};window[cb]=d=>d.ok?done(null,d):done(d.error||'Ошибка сервера');script.onerror=()=>done('Сервер недоступен');timeout=setTimeout(()=>done('Тайм-аут сервера'),20000);script.referrerPolicy='no-referrer';script.src=config.url+'?'+new URLSearchParams({...q,callback:cb,t:Date.now()});document.head.append(script)})}
async function post(q){const go=async()=>{const controller=new AbortController(),t=setTimeout(()=>controller.abort(),20000);try{await fetch(config.url,{method:'POST',mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(q),signal:controller.signal})}finally{clearTimeout(t)}};inflight=inflight.catch(()=>{}).then(go);return inflight}
export async function login(pin){if(!/^\d{6,12}$/.test(pin))throw Error('PIN: 6–12 цифр');if(!config.url)throw Error('Сначала укажите /exec');const nonce=uid();await post({action:'login',pin,nonce,role});for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,1000));const d=await jsonp({action:'loginResult',nonce});if(d.pending)continue;session=d.session;set('session.'+role,session);return}throw Error('Нет подтверждения входа')}
export async function logout(){if(config.cloud&&session){await post({action:'logout',session});let revoked=false;try{await jsonp({action:'status',session})}catch(e){if(e.message.startsWith('AUTH:'))revoked=true;else throw e}if(!revoked)throw Error('Сервер пока не подтвердил отзыв. Повторите через несколько секунд.')}session='';set('session.'+role,'')}
export const isCloud=()=>config.cloud;
export async function write(action,data={}){if(!config.cloud)throw Error('Локальный режим');if(!session)throw Error('Войдите по PIN в настройках');const requestId=uid();await post({action,session,instance,requestId,...data});for(let i=0;i<12;i++){const d=await jsonp({action:'operation',session,requestId});if(!d.pending)return d;await new Promise(r=>setTimeout(r,700))}throw Error('Неизвестен результат записи; проверьте диагностику')}
export async function read(action,data={}){if(!session)throw Error('Войдите по PIN в настройках');return jsonp({action,session,instance,...data})}
export function localState(state){set('live',{...state,at:Date.now(),instance})}
export function getLocalState(){return get('live',null)}
export function localCatalog(catalog){set('published',catalog)}
export function getLocalCatalog(){return get('published',null)}
export function sendLocal(cmd){const queue=get('queue',[]);if(queue.length>=20)throw Error('Очередь заполнена, включите плеер');queue.push(cmd);set('queue',queue)}
export function localCommands(){return get('queue',[])}
export function localAck(id,result){const receipts=get('receipts',{});receipts[id]=result;const entries=Object.entries(receipts).slice(-60);set('receipts',Object.fromEntries(entries));set('queue',get('queue',[]).filter(c=>c.id!==id))}
export function receipt(id){return get('receipts',{})[id]}
let held=false,releaseLock=null;
export async function acquireLocal(){if(held)return true;if(navigator.locks){return new Promise(resolve=>{navigator.locks.request(NS+'.player',{ifAvailable:true},async lock=>{if(!lock){resolve(false);return}held=true;resolve(true);await new Promise(r=>releaseLock=r);held=false}).catch(()=>resolve(false))})}const lease=get('lease',{});if(lease.at&&Date.now()-lease.at<15000&&lease.id!==instance)return false;set('lease',{id:instance,at:Date.now()});await new Promise(r=>setTimeout(r,180));held=get('lease',{}).id===instance;return held}
export function keepLocal(){if(!held)return false;if(!navigator.locks&&get('lease',{}).id!==instance){held=false;return false}set('lease',{id:instance,at:Date.now()});return true}
export function release(){releaseLock?.();if(get('lease',{}).id===instance)set('lease',{});held=false}
