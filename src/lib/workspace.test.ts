import {beforeEach,afterEach,describe,it,expect} from "vitest";
import Database from "better-sqlite3";
import {SCHEMA_SQL} from "./db";
import {WORKSPACE_SCHEMA,saveProperty,ownProperty,linkPropertyJob,assignTeam,sendJobMessage,setChecklist,importCalendar,parseCalendar} from "./workspace";
let db:Database.Database;
beforeEach(()=>{db=new Database(":memory:");db.pragma("foreign_keys=ON");db.exec(SCHEMA_SQL);db.exec(WORKSPACE_SCHEMA);db.exec("INSERT INTO users(id,role,name) VALUES('a','client','A'),('b','client','B'),('f','firma','F'),('g','firma','G');INSERT INTO firms(id,user_id,coverage_city) VALUES('firm','f','București'),('other','g','București')");});
afterEach(()=>db.close());
const property={name:"Acasă",city:"București",street:"Strada Test 1",sqm:75,space_type:"apartament",kind:"home",budget_bani:120000};
function job(id:string,start="2026-09-12T09:00:00Z",client="a",firm="firm"){db.prepare("INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,scheduled_at,price_gross,duration_minutes,status,accepted_firm_id) VALUES(?,?, 'Test','București',75,'apartament','scheduled',?,500,120,'accepted',?)").run(id,client,start,firm)}
describe("workspace ownership and scheduling",()=>{
 it("does not reveal, edit or associate another client's property",()=>{const id=saveProperty(db,"a",property);expect(()=>ownProperty(db,"b",id)).toThrow();expect(()=>saveProperty(db,"b",{...property,id})).toThrow();job("j");expect(()=>linkPropertyJob(db,"b",id,"j")).toThrow();expect(ownProperty(db,"a",id).budget_bani).toBe(120000)});
 it("rejects unbounded and noninteger budgets",()=>{expect(()=>saveProperty(db,"a",{...property,budget_bani:1.5})).toThrow();expect(()=>saveProperty(db,"a",{...property,sqm:Infinity})).toThrow()});
 it("associates only the owner's jobs",()=>{const id=saveProperty(db,"a",property);job("j",undefined,"b");expect(()=>linkPropertyJob(db,"a",id,"j")).toThrow()});
 it("rejects overlapping team assignments, including buffer, but allows adjacent slots",()=>{job("j1");job("j2","2026-09-12T11:15:00Z");job("j3","2026-09-12T11:30:00Z");db.exec("INSERT INTO workspace_teams(id,firm_id,name) VALUES('t','firm','Echipa')");assignTeam(db,"f","t","j1");expect(()=>assignTeam(db,"f","t","j2")).toThrow(/interval/);assignTeam(db,"f","t","j3");expect(db.prepare("SELECT * FROM workspace_assignments").all()).toHaveLength(2);expect(()=>assignTeam(db,"g","t","j1")).toThrow()});
 it("deduplicates retried messages and rejects conflicting reuse or outsiders",()=>{job("j");const id=sendJobMessage(db,"a","j","Bună ziua","retry-1");expect(sendJobMessage(db,"a","j","Bună ziua","retry-1")).toBe(id);expect(()=>sendJobMessage(db,"a","j","Alt mesaj","retry-1")).toThrow();expect(()=>sendJobMessage(db,"b","j","Salut","retry-2")).toThrow();expect(()=>sendJobMessage(db,"g","j","Salut","retry-3")).toThrow();expect(sendJobMessage(db,"f","j","Bună ziua","reply-1")).toBeTruthy()});
 it("restricts checklist updates to the allocated firm while job is active",()=>{job("j");expect(()=>setChecklist(db,"a","j","floors",true)).toThrow();expect(()=>setChecklist(db,"g","j","floors",true)).toThrow();setChecklist(db,"f","j","floors",true);db.exec("UPDATE jobs SET status='completed' WHERE id='j'");expect(()=>setChecklist(db,"f","j","floors",false)).toThrow()});
});
const calendar=(event:string)=>`BEGIN:VCALENDAR\r\n${event}\r\nEND:VCALENDAR`;
const event="BEGIN:VEVENT\r\nUID:booking-1\r\nDTSTART;VALUE=DATE:20260915\r\nDTEND;VALUE=DATE:20260918\r\nSUMMARY:Private guest name\r\nEND:VEVENT";
describe("calendar imports",()=>{
 it("upserts by property/source/UID and does not expose guest names",()=>{const id=saveProperty(db,"a",{...property,kind:"host"});importCalendar(db,"a",id,"PMS",calendar(event));importCalendar(db,"a",id,"PMS",calendar(event.replace("20260918","20260919")));const rows=db.prepare("SELECT * FROM workspace_calendar_events").all() as {summary:string;ends_at:string}[];expect(rows).toHaveLength(1);expect(rows[0].ends_at).toContain("2026-09-19");expect(rows[0].summary).toBe("Perioadă ocupată");expect(()=>importCalendar(db,"b",id,"PMS",calendar(event))).toThrow()});
 it("applies explicit cancellation and keeps events omitted from a later partial import",()=>{const id=saveProperty(db,"a",property);importCalendar(db,"a",id,"PMS",calendar(event));importCalendar(db,"a",id,"PMS",calendar("BEGIN:VEVENT\r\nUID:booking-1\r\nSTATUS:CANCELLED\r\nEND:VEVENT"));expect(db.prepare("SELECT status FROM workspace_calendar_events").get()).toEqual({status:"cancelled"})});
 it("rejects invalid dates and unsupported recurrence instead of silently shifting bookings",()=>{expect(()=>parseCalendar(calendar(event.replace("20260915","20260231")))).toThrow();expect(()=>parseCalendar(calendar(event.replace("SUMMARY:","RRULE:FREQ=DAILY\r\nSUMMARY:")))).toThrow()});
});
