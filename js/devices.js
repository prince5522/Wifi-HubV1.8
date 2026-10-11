import {requireUser,setupShell,$,message,apiRequest} from './common.js';
setupShell(); const host=$('#devicesGrid'), notice=$('#devicesMessage');
function showUnavailable(text){if(notice)notice.textContent=text;if(host)host.replaceChildren();}
async function refresh(){if(notice)notice.textContent='Checking for a configured device source…';if(host)host.replaceChildren();
 try{await requireUser();const data=await apiRequest('/devices');const devices=Array.isArray(data.devices)?data.devices:[];if(!devices.length){showUnavailable(data.message||'No compatible router has reported connected-device data. No devices have been invented.');return;}
 if(notice)notice.textContent=`${devices.length} device(s) reported by the configured integration.`;
 for(const d of devices){const card=document.createElement('article');card.className='device-card';const name=document.createElement('strong');name.textContent=d.name||d.hostname||'Unnamed device';const info=document.createElement('p');info.className='muted';info.textContent=[d.ip,d.mac,d.connection].filter(Boolean).join(' · ')||'Details not supplied';card.append(name,info);host?.append(card);}
 }catch(e){console.error(e);showUnavailable(e.message.includes('backend URL')?'Python backend is not connected yet. Device data will appear when the backend and router integration are configured.':e.message);}}
$('#refreshDevices')?.addEventListener('click',refresh);refresh();
