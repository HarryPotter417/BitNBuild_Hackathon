import { buildSeed } from "../server/seed.js";
import { getPool, withTransaction } from "../server/database.js";
import { hashPassword } from "../server/auth.js";

const adminEmail=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
const adminPassword=process.env.ADMIN_PASSWORD;
if(!adminEmail||!adminPassword)throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding the deployment administrator.");
const pool=getPool();
const catalog=buildSeed().events;
await withTransaction(async(client)=>{
  for(const event of catalog){
    const start=new Date(event.startsAt);
    start.setUTCFullYear(Math.max(start.getUTCFullYear()+1,new Date().getUTCFullYear()+1));
    await client.query(`INSERT INTO events(id,title,tagline,description,category,city,venue,starts_at,capacity,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED') ON CONFLICT(id) DO NOTHING`,
      [event.id,event.title,event.tagline,event.about,event.category,event.city,event.venue,start,event.capacity]);
  }
  const passwordHash=await hashPassword(adminPassword);
  await client.query(`INSERT INTO users(email,display_name,password_hash,email_verified_at,role)
    VALUES($1,'Fair Drop Admin',$2,now(),'admin') ON CONFLICT(email) DO UPDATE SET role='admin',email_verified_at=coalesce(users.email_verified_at,now())`,[adminEmail,passwordHash]);
});
console.log(`Seeded ${catalog.length} scheduled events and provisioned the administrator.`);
await pool.end();
