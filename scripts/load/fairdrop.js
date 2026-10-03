import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import crypto from "k6/crypto";

const baseUrl=__ENV.FAIRDROP_BASE_URL||"http://localhost:3000";
const mode=__ENV.FAIRDROP_SCENARIO||"normal-crowd";
const duration=__ENV.FAIRDROP_DURATION||"60s";
const vus=Number(__ENV.FAIRDROP_VUS||20);
const cookies=(__ENV.FAIRDROP_SESSION_COOKIES||"").split(",").map((value)=>value.trim()).filter(Boolean);
const eventId=__ENV.FAIRDROP_EVENT_ID||"";
const responses429=new Counter("fairdrop_http_429");
const responses503=new Counter("fairdrop_http_503");
const businessAccepted=new Counter("fairdrop_entry_responses_2xx");
const businessRejected=new Counter("fairdrop_entry_responses_4xx");
const challengeLatency=new Trend("fairdrop_challenge_ms",true);

const profiles={
  "normal-crowd":{executor:"ramping-vus",startVUs:0,stages:[{duration:"15s",target:Math.max(1,Math.round(vus*.25))},{duration:"30s",target:vus},{duration:"15s",target:0}],gracefulRampDown:"5s"},
  "single-user-spam":{executor:"constant-vus",vus:1,duration},
  "bot-flood":{executor:"constant-vus",vus,duration},
  "duplicate-join":{executor:"constant-vus",vus:Math.min(vus,Math.max(1,cookies.length)),duration},
  "retry-storm":{executor:"ramping-arrival-rate",startRate:Math.max(1,vus),timeUnit:"1s",preAllocatedVUs:vus,maxVUs:vus*4,stages:[{duration:"15s",target:vus*5},{duration:"30s",target:vus*20},{duration:"15s",target:0}]},
  "claim-race":{executor:"constant-vus",vus:Math.min(vus,Math.max(1,cookies.length)),duration},
  health:{executor:"constant-vus",vus,duration},
};

export const options={scenarios:{selected:{exec:"runScenario",...(profiles[mode]||profiles["normal-crowd"])}},thresholds:{http_req_duration:["p(95)<2500","p(99)<5000"],http_req_failed:["rate<0.25"]},summaryTrendStats:["avg","min","med","max","p(90)","p(95)","p(99)"]};

export function runScenario(){
  if(mode==="bot-flood")return botFlood();
  if(mode==="health")return healthProbe();
  if(mode==="claim-race")return claimRace();
  return joinAttempt();
}

function healthProbe(){
  const response=http.get(`${baseUrl}/api/health`);
  observe(response);
  check(response,{"health endpoint responds":(r)=>[200,503].includes(r.status)});
  sleep(.2);
}

function botFlood(){
  const response=http.post(`${baseUrl}/api/security/challenge`,null,{headers:{"Content-Type":"application/json"}});
  observe(response);
  check(response,{"anonymous challenge is rejected or rate limited":(r)=>[401,429].includes(r.status)});
  sleep(.05);
}

function joinAttempt(){
  if(!eventId||!cookies.length)throw new Error("Set FAIRDROP_EVENT_ID and comma-separated verified FAIRDROP_SESSION_COOKIES for join scenarios.");
  const cookie=cookies[(__VU-1)%cookies.length];
  const headers={Cookie:`fairdrop_session=${cookie}`,"Content-Type":"application/json"};
  const challenge=http.post(`${baseUrl}/api/security/challenge`,null,{headers});
  challengeLatency.add(challenge.timings.duration);observe(challenge);
  if(challenge.status!==200){check(challenge,{"challenge is granted, throttled or denied safely":(r)=>[401,403,429,503].includes(r.status)});sleep(.1);return;}
  const payload=challenge.json();
  const solution=solve(payload.token,payload.difficultyBits);
  const response=http.post(`${baseUrl}/api/events/${eventId}/join`,JSON.stringify({challenge:payload.token,solution}),{headers});
  observe(response);
  if(response.status>=200&&response.status<300)businessAccepted.add(1);
  if(response.status>=400&&response.status<500)businessRejected.add(1);
  check(response,{"join preserves one-entry semantics or returns a controlled status":(r)=>[200,401,403,404,409,429,503].includes(r.status)});
  sleep(.1);
}

function claimRace(){
  if(!eventId||!cookies.length)throw new Error("Claim race requires FAIRDROP_EVENT_ID and verified user session cookies for selected participants.");
  const cookie=cookies[(__VU-1)%cookies.length];
  const key=`k6-${__VU}-${__ITER}-${crypto.sha256(`${__VU}:${__ITER}:${Date.now()}`,"hex").slice(0,32)}`;
  const response=http.post(`${baseUrl}/api/events/${eventId}/claim`,null,{headers:{Cookie:`fairdrop_session=${cookie}`,"Idempotency-Key":key}});
  observe(response);
  check(response,{"claim is accepted or rejected by allocation state":(r)=>[200,401,404,409,410,429,503].includes(r.status)});
  sleep(.1);
}

function solve(token,difficultyBits){
  const nonce=token.split(".")[0];
  for(let counter=0;counter<100_000_000;counter++){
    if(leadingZeroBits(crypto.sha256(`${nonce}:${counter}`,"hex"))>=difficultyBits)return String(counter);
  }
  throw new Error("Proof-of-work solve limit reached.");
}

function leadingZeroBits(hex){
  let count=0;
  for(let i=0;i<hex.length;i+=2){const byte=Number.parseInt(hex.slice(i,i+2),16);if(byte===0){count+=8;continue;}count+=Math.clz32(byte)-24;break;}
  return count;
}

function observe(response){if(response.status===429)responses429.add(1);if(response.status===503)responses503.add(1);}

export function handleSummary(data){
  return {stdout:`Fair Drop measured k6 run · ${mode}\n`+JSON.stringify(data.metrics,null,2)+"\n"};
}
