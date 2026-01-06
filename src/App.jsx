import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Plus, Search, Download, Printer, Trash2, Copy, Users, LogOut, KeyRound, ClipboardList } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card.jsx";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";
import { Label } from "./components/ui/label.jsx";
import { Badge } from "./components/ui/badge.jsx";
import { Checkbox } from "./components/ui/checkbox.jsx";
import { Textarea } from "./components/ui/textarea.jsx";
import { Separator } from "./components/ui/separator.jsx";

const STORAGE_KEY = "looe_roofing_experts_fullsync_v1";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ENV_OK = Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const BRAND = { appName: "LOOE ROOFING EXPERTS LTD", logoPath: "/looe-roofing-experts.png" };

const STAGES = [
  { key: "lead_in", label: "Lead In" },
  { key: "survey", label: "Survey" },
  { key: "quote", label: "Quote" },
  { key: "follow_up", label: "Follow-Up" },
  { key: "job_won", label: "Job Won" },
  { key: "job_prep", label: "Job Prep" },
  { key: "job_live", label: "Job Live" },
  { key: "completion", label: "Completion" },
  { key: "payment", label: "Payment" },
  { key: "aftercare", label: "Aftercare" },
];

const DEFAULT_WORKFLOW = [
  { stage: "lead_in", responsible: "Admin", task: "Log new enquiry", steps: "Record name, address, phone, source" },
  { stage: "lead_in", responsible: "Admin", task: "Initial response", steps: "Call or email customer" },
  { stage: "survey", responsible: "Owner", task: "Book site visit", steps: "Confirm date/time" },
  { stage: "survey", responsible: "Owner", task: "Site inspection", steps: "Assess roof, take photos, note risks" },
  { stage: "quote", responsible: "Owner", task: "Prepare quote", steps: "Labour, materials, timescale, warranty" },
  { stage: "quote", responsible: "Admin", task: "Send quote", steps: "Email quote" },
  { stage: "follow_up", responsible: "Admin", task: "Follow-up call 1", steps: "Confirm receipt, answer questions" },
  { stage: "follow_up", responsible: "Admin", task: "Follow-up call 2", steps: "Decision prompt" },
  { stage: "job_won", responsible: "Owner", task: "Schedule job", steps: "Allocate van & team" },
  { stage: "job_prep", responsible: "Owner", task: "Materials ordered", steps: "Confirm delivery date" },
  { stage: "job_live", responsible: "Team Lead", task: "Complete works", steps: "Quality check on completion" },
  { stage: "completion", responsible: "Owner", task: "Customer sign-off", steps: "Photos + satisfaction check" },
  { stage: "payment", responsible: "Admin", task: "Invoice & collect payment", steps: "Send invoice, confirm payment" },
  { stage: "aftercare", responsible: "Admin", task: "Request review", steps: "Send review link" },
];

function uid(){ return (crypto?.randomUUID?.() || (Math.random().toString(16).slice(2)+Date.now().toString(16))); }
function todayISO(){ const d=new Date(); const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function stageLabel(k){ return STAGES.find(s=>s.key===k)?.label ?? k; }
function roleLabel(r){ return r==="owner"?"Owner":r==="admin"?"Admin":r==="team_lead"?"Team Lead":(r||"—"); }
function memberDisplay(m){ return m.display_name || m.email || m.user_id; }

function seed(){
  return {
    leads: [],
    settings: { followUp1Days: 2, followUp2Days: 5 },
    cloud: { orgId:null, role:null, email:null, userId:null, lastSyncAt:null }
  };
}
function loadState(){ try{ const r=localStorage.getItem(STORAGE_KEY); return r? { ...seed(), ...JSON.parse(r)} : seed(); }catch{return seed();} }
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function buildChecklist(){
  return DEFAULT_WORKFLOW.map(w=>({ id: uid(), stage:w.stage, responsible:w.responsible, task:w.task, steps:w.steps, status:"not_started", dueISO:"", notes:"" }));
}
function computeLeadStageFromChecklist(items){
  for(const st of STAGES){
    const inStage = items.filter(i=>i.stage===st.key);
    if(!inStage.length) continue;
    if(!inStage.every(i=>i.status==="done")) return st.key;
  }
  return STAGES[STAGES.length-1].key;
}
function toCSV(rows){
  const esc=v=>{ const s=String(v??""); return /[\n\r,"]/g.test(s)?`"${s.replaceAll('"','""')}"`:s; };
  return rows.map(r=>r.map(esc).join(",")).join("\n");
}
function downloadText(filename, text){
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// -------- Supabase helpers --------
async function ensureOrgAndMembership(user){
  const { data: membership, error: memErr } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if(memErr) throw memErr;
  if(membership?.org_id) return { orgId: membership.org_id, role: membership.role };

  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .insert({ name: BRAND.appName, created_by: user.id })
    .select("id")
    .single();
  if(orgErr) throw orgErr;

  const { error: joinErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: user.id, role: "owner", email: user.email, display_name: user.email });
  if(joinErr) throw joinErr;

  return { orgId: org.id, role: "owner" };
}

async function cloudFetchLeads(orgId){
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, address, source, created_iso, stage, notes, next_action_label, next_action_due_iso, checklist, assigned_to, team, van, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  if(error) throw error;
  return (data||[]).map(r=>({
    id: r.id,
    customerName: r.customer_name || "",
    phone: r.phone || "",
    address: r.address || "",
    source: r.source || "",
    createdISO: r.created_iso || todayISO(),
    stage: r.stage || "lead_in",
    notes: r.notes || "",
    nextActionLabel: r.next_action_label || "",
    nextActionDueISO: r.next_action_due_iso || "",
    checklist: Array.isArray(r.checklist) ? r.checklist : buildChecklist(),
    assignedTo: r.assigned_to || "",
    team: r.team || "",
    van: r.van || "",
    updatedAt: r.updated_at || null,
  }));
}

async function cloudUpsertLead(orgId, userId, lead){
  const payload = {
    id: lead.id,
    org_id: orgId,
    created_by: userId,
    customer_name: lead.customerName,
    phone: lead.phone,
    address: lead.address,
    source: lead.source,
    created_iso: lead.createdISO,
    stage: lead.stage,
    notes: lead.notes,
    next_action_label: lead.nextActionLabel || null,
    next_action_due_iso: lead.nextActionDueISO || null,
    checklist: lead.checklist,
    assigned_to: lead.assignedTo || null,
    team: lead.team || null,
    van: lead.van || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").upsert(payload);
  if(error) throw error;
}

async function cloudDeleteLead(orgId, leadId){
  const { error } = await supabase.from("leads").delete().eq("org_id", orgId).eq("id", leadId);
  if(error) throw error;
}

async function cloudListMembers(orgId){
  const { data, error } = await supabase.from("org_members").select("user_id, role, email, display_name").eq("org_id", orgId);
  if(error) throw error;
  return data || [];
}

async function cloudLogActivity({ orgId, leadId, userId, actorEmail, action, details }){
  const payload = { org_id: orgId, lead_id: leadId, actor_id: userId, actor_email: actorEmail || null, action, details: details || null };
  const { error } = await supabase.from("lead_activity").insert(payload);
  if(error) throw error;
}

async function cloudFetchActivity(orgId, leadId, limit=30){
  const { data, error } = await supabase
    .from("lead_activity")
    .select("id, action, details, actor_email, created_at")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if(error) throw error;
  return data || [];
}

export default function App(){
  const [state, setState] = useState(()=>loadState());
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [vanFilter, setVanFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("checklist"); // checklist | activity | team
  const [cloudStatus, setCloudStatus] = useState(supabase ? "signed_out" : "local_only");
  const [cloudError, setCloudError] = useState("");
  const [members, setMembers] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [inviteRole, setInviteRole] = useState("team_lead");
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const syncingRef = useRef(false);

  useEffect(()=>{ document.title = BRAND.appName; }, []);
  useEffect(()=>{ saveState(state); }, [state]);

  const active = useMemo(()=> state.leads.find(l=>l.id===activeId) || null, [state.leads, activeId]);

  const canDelete = cloudStatus==="local_only" || state.cloud?.role==="owner" || state.cloud?.role==="admin";
  const canInvite = state.cloud?.role==="owner" || state.cloud?.role==="admin";

  // Init Supabase session + org + initial sync + realtime
  useEffect(()=>{
    if(!supabase) return;
    let cancelled=false;
    let channel;

    async function init(){
      setCloudError("");
      const { data: { session } } = await supabase.auth.getSession();
      if(cancelled) return;

      if(!session?.user){
        setCloudStatus("signed_out");
        return;
      }
      setCloudStatus("signed_in");

      try{
        const { orgId, role } = await ensureOrgAndMembership(session.user);
        const leads = await cloudFetchLeads(orgId);
        const mem = await cloudListMembers(orgId);
        if(cancelled) return;

        setMembers(mem);
        setState(s=>({
          ...s,
          leads,
          cloud:{ ...s.cloud, orgId, role, email: session.user.email, userId: session.user.id, lastSyncAt: new Date().toISOString() }
        }));

        channel = supabase
          .channel("looe_leads_changes")
          .on("postgres_changes", { event:"*", schema:"public", table:"leads", filter:`org_id=eq.${orgId}` }, async ()=>{
            if(syncingRef.current) return;
            try{
              syncingRef.current=true;
              const latest = await cloudFetchLeads(orgId);
              const mem2 = await cloudListMembers(orgId);
              if(!cancelled){
                setMembers(mem2);
                setState(s=>({ ...s, leads: latest, cloud:{ ...s.cloud, lastSyncAt: new Date().toISOString() } }));
              }
            }catch(e){
              if(!cancelled) setCloudError(e?.message || String(e));
            }finally{
              syncingRef.current=false;
            }
          })
          .subscribe();

      }catch(e){
        if(!cancelled) setCloudError(e?.message || String(e));
      }
    }

    init();
    const { data: sub } = supabase.auth.onAuthStateChange(()=>init());

    return ()=>{
      cancelled=true;
      sub?.subscription?.unsubscribe?.();
      if(channel) supabase.removeChannel(channel);
    };
  }, []);

  // Load activity when active lead changes
  useEffect(()=>{
    if(!supabase || cloudStatus!=="signed_in" || !state.cloud?.orgId || !activeId){
      setActivityItems([]);
      return;
    }
    let cancelled=false;
    (async ()=>{
      try{
        const items = await cloudFetchActivity(state.cloud.orgId, activeId, 30);
        if(!cancelled) setActivityItems(items);
      }catch(e){
        if(!cancelled) setCloudError(e?.message || String(e));
      }
    })();
    return ()=>{ cancelled=true; };
  }, [activeId, cloudStatus, state.cloud?.orgId]);

  const vanOptions = useMemo(()=>{
    const set=new Set();
    state.leads.forEach(l=> l.van && set.add(l.van));
    const arr=[...set].sort();
    return arr.length?arr:["Van 1","Van 2"];
  }, [state.leads]);

  const assignedOptions = useMemo(()=>{
    const set=new Set();
    state.leads.forEach(l=> l.assignedTo && set.add(l.assignedTo));
    const arr=[...set].sort();
    return arr;
  }, [state.leads]);

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    let list=state.leads;
    if(stageFilter!=="all") list=list.filter(l=>l.stage===stageFilter);
    if(vanFilter!=="all") list=list.filter(l=>(l.van||"")===vanFilter);
    if(assignedFilter!=="all") list=list.filter(l=>(l.assignedTo||"")===assignedFilter);
    if(q){
      list=list.filter(l=> [l.customerName,l.phone,l.address,l.source,l.notes,l.assignedTo,l.team,l.van].join(" ").toLowerCase().includes(q));
    }
    return list;
  }, [state.leads, query, stageFilter, vanFilter, assignedFilter]);

  function newLead(){
    const id=uid();
    const lead={ id, customerName:"", phone:"", address:"", source:"", createdISO: todayISO(), stage:"lead_in",
      notes:"", nextActionLabel:"", nextActionDueISO:"", checklist: buildChecklist(), assignedTo:"", team:"", van:"",
      updatedAt: new Date().toISOString()
    };
    setState(s=>({ ...s, leads:[lead, ...s.leads] }));
    setActiveId(id);
    setTab("checklist");
    // cloud create log happens on first save
  }

  async function saveLead(updated){
    const stage = computeLeadStageFromChecklist(updated.checklist);
    const withStage = { ...updated, stage, updatedAt: new Date().toISOString() };
    setState(s=>({ ...s, leads: s.leads.map(l=>l.id===withStage.id?withStage:l) }));

    if(!supabase || cloudStatus!=="signed_in" || !state.cloud?.orgId || !state.cloud?.userId) return;
    try{
      syncingRef.current=true;
      await cloudUpsertLead(state.cloud.orgId, state.cloud.userId, withStage);
      await cloudLogActivity({
        orgId: state.cloud.orgId,
        leadId: withStage.id,
        userId: state.cloud.userId,
        actorEmail: state.cloud.email,
        action: "Saved lead",
        details: `Stage: ${stageLabel(stage)}`
      });
      const items = await cloudFetchActivity(state.cloud.orgId, withStage.id, 30);
      setActivityItems(items);
    }catch(e){
      setCloudError(e?.message || String(e));
    }finally{
      syncingRef.current=false;
    }
  }

  function updateActive(patch){
    if(!active) return;
    saveLead({ ...active, ...patch });
  }

  function updateChecklistItem(itemId, patch){
    if(!active) return;
    const next = active.checklist.map(it=> it.id===itemId ? { ...it, ...patch } : it);
    saveLead({ ...active, checklist: next });
    if(supabase && cloudStatus==="signed_in" && state.cloud?.orgId && state.cloud?.userId){
      cloudLogActivity({
        orgId: state.cloud.orgId,
        leadId: active.id,
        userId: state.cloud.userId,
        actorEmail: state.cloud.email,
        action: "Checklist update",
        details: `Item: ${active.checklist.find(x=>x.id===itemId)?.task || "(task)"}\nPatch: ${JSON.stringify(patch)}`
      }).then(async ()=>{
        const items = await cloudFetchActivity(state.cloud.orgId, active.id, 30);
        setActivityItems(items);
      }).catch(e=>setCloudError(e?.message || String(e)));
    }
  }

  function duplicateLead(id){
    const o=state.leads.find(l=>l.id===id); if(!o) return;
    const c=structuredClone(o);
    c.id=uid();
    c.createdISO=todayISO();
    c.customerName = c.customerName ? c.customerName + " (copy)" : "Copy";
    c.checklist = c.checklist.map(i=>({ ...i, id: uid(), status:"not_started" }));
    c.stage="lead_in";
    c.nextActionLabel=""; c.nextActionDueISO="";
    c.updatedAt=new Date().toISOString();
    setState(s=>({ ...s, leads:[c, ...s.leads] }));
  }

  async function deleteLead(id){
    if(!canDelete) return;
    setState(s=>({ ...s, leads: s.leads.filter(l=>l.id!==id) }));
    if(activeId===id) setActiveId(null);

    if(!supabase || cloudStatus!=="signed_in" || !state.cloud?.orgId) return;
    try{
      syncingRef.current=true;
      await cloudDeleteLead(state.cloud.orgId, id);
    }catch(e){
      setCloudError(e?.message || String(e));
    }finally{
      syncingRef.current=false;
    }
  }

  function exportCSV(){
    const header=["Lead ID","Customer","Phone","Address","Source","Created","Stage","Assigned To","Team","Van","Next Action","Next Due","Lead Notes","Item Stage","Responsible","Task","Steps","Status","Due","Item Notes"];
    const lines=[header];
    state.leads.forEach(l=>{
      l.checklist.forEach(it=>{
        lines.push([l.id,l.customerName,l.phone,l.address,l.source,l.createdISO,stageLabel(l.stage),l.assignedTo,l.team,l.van,l.nextActionLabel,l.nextActionDueISO,l.notes,stageLabel(it.stage),it.responsible,it.task,it.steps,it.status,it.dueISO,it.notes]);
      });
    });
    downloadText(`looe-roofing-experts-fullsync-${todayISO()}.csv`, toCSV(lines));
  }

  async function signIn(){
    if(!supabase) return;
    try{
      const email = prompt("Enter your email for magic-link sign-in");
      if(!email) return;
      const { error } = await supabase.auth.signInWithOtp({ email });
      if(error) throw error;
      alert("Check your email for the sign-in link.");
    }catch(e){
      setCloudError(e?.message || String(e));
    }
  }

  async function signOut(){
    if(!supabase) return;
    await supabase.auth.signOut();
    setCloudStatus("signed_out");
    setMembers([]);
    setActivityItems([]);
    setState(s=>({ ...s, cloud:{ ...s.cloud, orgId:null, role:null, email:null, userId:null } }));
  }

  async function createInvite(){
    if(!supabase || cloudStatus!=="signed_in" || !state.cloud?.orgId || !canInvite) return;
    try{
      setCloudError("");
      const code = uid().replaceAll("-","").slice(0,10).toUpperCase();
      const { error } = await supabase.from("org_invites").insert({
        code,
        org_id: state.cloud.orgId,
        role: inviteRole,
        created_by: state.cloud.userId
      });
      if(error) throw error;
      setInviteCode(code);
    }catch(e){
      setCloudError(e?.message || String(e));
    }
  }

  async function redeemInvite(){
    if(!supabase || cloudStatus!=="signed_in" || !state.cloud?.userId) return;
    try{
      setCloudError("");
      const code = joinCode.trim().toUpperCase();
      if(!code) return;

      const { data: inv, error: invErr } = await supabase
        .from("org_invites")
        .select("code, org_id, role, redeemed_by")
        .eq("code", code)
        .maybeSingle();
      if(invErr) throw invErr;
      if(!inv) throw new Error("Invite code not found.");
      if(inv.redeemed_by) throw new Error("Invite code already used.");

      const { error: joinErr } = await supabase.from("org_members").insert({
        org_id: inv.org_id,
        user_id: state.cloud.userId,
        role: inv.role,
        email: state.cloud.email,
        display_name: state.cloud.email
      });
      if(joinErr) throw joinErr;

      const { error: redErr } = await supabase.from("org_invites").update({
        redeemed_by: state.cloud.userId,
        redeemed_at: new Date().toISOString()
      }).eq("code", code);
      if(redErr) throw redErr;

      const leads = await cloudFetchLeads(inv.org_id);
      const mem = await cloudListMembers(inv.org_id);
      setMembers(mem);
      setState(s=>({ ...s, leads, cloud:{ ...s.cloud, orgId: inv.org_id, role: inv.role, lastSyncAt: new Date().toISOString() } }));
      setJoinCode("");
      alert("Joined workspace.");
    }catch(e){
      setCloudError(e?.message || String(e));
    }
  }

   return (
    <div style={{ minHeight: "100vh", padding: 16 }}>
      <div
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 99999,
          background: "black",
          color: "white",
          padding: "6px 10px",
          borderRadius: "8px",
          fontSize: "12px",
        }}
      >
        BUILD: 22fde66
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:12, flexWrap:"wrap"}}>
          <div style={{display:"flex", gap:12, alignItems:"center"}}>
            <div style={{height:44, width:44, borderRadius:16, overflow:"hidden", border:"1px solid #e2e8f0", background:"#fff"}}>
              <img src={BRAND.logoPath} alt="Logo" style={{height:"100%", width:"100%", objectFit:"contain"}} />
            </div>
            <div>
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} style={{fontSize:24, fontWeight:800}}>
                {BRAND.appName}
              </motion.div>
              <div style={{fontSize:13, color:"#64748b"}}>
                Full synced app ✅ {cloudStatus==="signed_in" ? `· Synced · ${roleLabel(state.cloud?.role)}` : (supabase ? "· Not signed in" : "· Local only")}
<div style={{fontSize:12, marginTop:6, color: ENV_OK ? "#16a34a" : "#b91c1c"}}>
  Supabase env loaded: {String(ENV_OK)}
</div>

              </div>
              {cloudError ? <div style={{marginTop:8, fontSize:12, color:"#b91c1c"}}>Cloud error: {cloudError}</div> : null}
            </div>
          </div>

          <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
            {supabase ? (
              cloudStatus==="signed_in" ? (
                <>
                  <Button variant="outline" onClick={()=>{ setTab("team"); }}><Users size={16}/>Team</Button>
                  <Button variant="outline" onClick={signOut}><LogOut size={16}/>Sign out</Button>
                </>
              ) : (
                <Button variant="outline" onClick={signIn}>Sign in</Button>
              )
            ) : null}

            <Button onClick={newLead}><Plus size={16}/>New lead</Button>
            <Button variant="outline" onClick={exportCSV}><Download size={16}/>Export CSV</Button>
            <Button variant="outline" onClick={()=>window.print()}><Printer size={16}/>Print</Button>
          </div>
        </div>

        <Card style={{marginTop:16}}>
          <CardContent className="p-4">
            <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
              <div style={{flex:"1 1 280px", display:"flex", gap:8, alignItems:"center"}}>
                <Search size={16} color="#64748b"/>
                <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, address, notes, assigned, van..." />
              </div>

              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <div>
                  <Label>Stage</Label>
                  <select value={stageFilter} onChange={(e)=>setStageFilter(e.target.value)} style={{width:180, border:"1px solid #e2e8f0", borderRadius:12, padding:"8px 10px"}}>
                    <option value="all">All</option>
                    {STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Van</Label>
                  <select value={vanFilter} onChange={(e)=>setVanFilter(e.target.value)} style={{width:160, border:"1px solid #e2e8f0", borderRadius:12, padding:"8px 10px"}}>
                    <option value="all">All</option>
                    {vanOptions.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Assigned</Label>
                  <select value={assignedFilter} onChange={(e)=>setAssignedFilter(e.target.value)} style={{width:220, border:"1px solid #e2e8f0", borderRadius:12, padding:"8px 10px"}}>
                    <option value="all">All</option>
                    {assignedOptions.map(a=><option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div style={{marginTop:16, display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:12}}>
          {filtered.length ? filtered.map(lead=>(
            <Card key={lead.id}>
              <CardHeader className="pb-3">
                <div style={{display:"flex", justifyContent:"space-between", gap:8}}>
                  <div style={{minWidth:0}}>
                    <CardTitle className="text-base">{lead.customerName || "(Unnamed lead)"}</CardTitle>
                    <div style={{fontSize:13, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{lead.address || "—"}</div>
                    <div style={{marginTop:8, display:"flex", gap:6, flexWrap:"wrap"}}>
                      <Badge>{stageLabel(lead.stage)}</Badge>
                      {lead.van ? <Badge>Van: {lead.van}</Badge> : null}
                      {lead.assignedTo ? <Badge>Assigned: {lead.assignedTo}</Badge> : null}
                      {lead.team ? <Badge>Team: {lead.team}</Badge> : null}
                    </div>
                  </div>
                  <div style={{display:"flex", gap:6}}>
                    <Button size="icon" variant="outline" onClick={()=>duplicateLead(lead.id)} title="Duplicate"><Copy size={16}/></Button>
                    <Button size="icon" variant="outline" onClick={()=>deleteLead(lead.id)} title={canDelete ? "Delete" : "Only owner/admin can delete"} disabled={!canDelete}><Trash2 size={16}/></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div style={{fontSize:12, color:"#64748b"}}>Created: {lead.createdISO}</div>
                  <Button variant="outline" onClick={()=>{ setActiveId(lead.id); setTab("checklist"); }}>Open</Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card>
              <CardContent style={{padding:24}}>
                <div style={{fontWeight:700}}>No leads found</div>
                <div style={{marginTop:6, fontSize:13, color:"#64748b"}}>Create one and run it through the checklist.</div>
              </CardContent>
            </Card>
          )}
        </div>

        {active ? (
          <Card style={{marginTop:18}}>
            <CardHeader>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap"}}>
                <div>
                  <CardTitle>Edit lead</CardTitle>
                  <div style={{fontSize:12, color:"#64748b"}}>Assignment dropdown + van/team + checklist + activity log.</div>
                </div>
                <div style={{display:"flex", gap:8}}>
                  <Button variant={tab==="checklist"?"default":"outline"} onClick={()=>setTab("checklist")}>Checklist</Button>
                  <Button variant={tab==="activity"?"default":"outline"} onClick={()=>setTab("activity")}>Activity</Button>
                  <Button variant="outline" onClick={()=>setActiveId(null)}>Close</Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px,1fr))", gap:12}}>
                <div>
                  <Label>Customer name</Label>
                  <Input value={active.customerName} onChange={(e)=>updateActive({ customerName:e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={active.phone} onChange={(e)=>updateActive({ phone:e.target.value })} />
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <Label>Address</Label>
                  <Textarea value={active.address} onChange={(e)=>updateActive({ address:e.target.value })} />
                </div>
                <div>
                  <Label>Lead source</Label>
                  <Input value={active.source} onChange={(e)=>updateActive({ source:e.target.value })} placeholder="Booklet / Website / WOM" />
                </div>
                <div>
                  <Label>Created</Label>
                  <Input type="date" value={active.createdISO} onChange={(e)=>updateActive({ createdISO:e.target.value })} />
                </div>

                <div>
                  <Label>Van</Label>
                  <Input value={active.van} onChange={(e)=>updateActive({ van:e.target.value })} placeholder="e.g., Van 1" />
                </div>
                <div>
                  <Label>Team</Label>
                  <Input value={active.team} onChange={(e)=>updateActive({ team:e.target.value })} placeholder="e.g., Team A" />
                </div>

                <div>
                  <Label>Assigned to (dropdown)</Label>
                  <select
                    value={active.assignedTo || ""}
                    onChange={(e)=>updateActive({ assignedTo: e.target.value })}
                    style={{width:"100%", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 10px"}}
                    disabled={cloudStatus!=="signed_in"} /* dropdown needs team list */
                    title={cloudStatus!=="signed_in" ? "Sign in to use team dropdown. You can still type below." : ""}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m=>(
                      <option key={m.user_id} value={memberDisplay(m)}>{memberDisplay(m)} · {roleLabel(m.role)}</option>
                    ))}
                  </select>
                  <div style={{fontSize:12, color:"#64748b", marginTop:6}}>Optional: type a custom label.</div>
                  <Input value={active.assignedTo} onChange={(e)=>updateActive({ assignedTo:e.target.value })} placeholder="Custom assigned label" />
                </div>

                <div style={{gridColumn:"1 / -1"}}>
                  <Label>Notes</Label>
                  <Textarea value={active.notes} onChange={(e)=>updateActive({ notes:e.target.value })} />
                </div>
              </div>

              <Separator className="my-4" />

              {tab==="checklist" ? (
                <>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
                    <div style={{fontWeight:700}}>Checklist</div>
                    <Badge>Stage auto: {stageLabel(active.stage)}</Badge>
                  </div>

                  <div style={{marginTop:10, display:"grid", gap:10}}>
                    {active.checklist.map(it=>(
                      <div key={it.id} style={{border:"1px solid #e2e8f0", borderRadius:16, padding:12, background:"#fff"}}>
                        <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                          <Checkbox checked={it.status==="done"} onCheckedChange={(v)=>{
                            const status=v?"done":"not_started";
                            updateChecklistItem(it.id, { status });
                          }} />
                          <div style={{flex:1}}>
                            <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                              <div style={{fontWeight:700}}>{it.task}</div>
                              <Badge>{stageLabel(it.stage)}</Badge>
                              <Badge>{it.status}</Badge>
                              {it.responsible ? <Badge>Resp: {it.responsible}</Badge> : null}
                            </div>
                            <div style={{marginTop:6, fontSize:12, color:"#64748b"}}>{it.steps}</div>
                            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:10, marginTop:10}}>
                              <div>
                                <Label>Due date (optional)</Label>
                                <Input type="date" value={it.dueISO || ""} onChange={(e)=>updateChecklistItem(it.id, { dueISO: e.target.value })} />
                              </div>
                              <div>
                                <Label>Item notes</Label>
                                <Input value={it.notes || ""} onChange={(e)=>updateChecklistItem(it.id, { notes: e.target.value })} placeholder="Access issues, extras..." />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <ClipboardList size={18} />
                    <div style={{fontWeight:800}}>Activity log</div>
                  </div>
                  <div style={{marginTop:10, display:"grid", gap:10}}>
                    {activityItems.length ? activityItems.map(a=>(
                      <div key={a.id} style={{border:"1px solid #e2e8f0", borderRadius:16, padding:12, background:"#fff"}}>
                        <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
                          <div style={{fontWeight:700}}>{a.action}</div>
                          <div style={{fontSize:12, color:"#64748b"}}>{new Date(a.created_at).toLocaleString("en-GB")}</div>
                        </div>
                        {a.actor_email ? <div style={{fontSize:12, color:"#64748b"}}>By: {a.actor_email}</div> : null}
                        {a.details ? <pre style={{marginTop:8, whiteSpace:"pre-wrap", fontSize:12, color:"#334155"}}>{a.details}</pre> : null}
                      </div>
                    )) : (
                      <div style={{fontSize:13, color:"#64748b"}}>No activity yet.</div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {tab==="team" ? (
          <Card style={{marginTop:18}}>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <div style={{fontSize:12, color:"#64748b"}}>Invite codes + members list. (Owner/Admin can invite.)</div>
            </CardHeader>
            <CardContent>
              {cloudStatus!=="signed_in" ? (
                <div style={{fontSize:13, color:"#64748b"}}>Sign in to manage team.</div>
              ) : (
                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px,1fr))", gap:12}}>
                  <Card>
                    <CardContent style={{paddingTop:16}}>
                      <div style={{display:"flex", alignItems:"center", gap:8, fontWeight:800}}><KeyRound size={16}/>Create invite code</div>
                      <div style={{marginTop:6, fontSize:12, color:"#64748b"}}>Owner/Admin generates a code. Teammate signs in, then enters the code to join.</div>

                      <div style={{marginTop:12}}>
                        <Label>Role for invite</Label>
                        <select value={inviteRole} onChange={(e)=>setInviteRole(e.target.value)} disabled={!canInvite}
                          style={{width:"100%", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 10px"}}>
                          <option value="admin">Admin</option>
                          <option value="team_lead">Team Lead</option>
                        </select>
                      </div>

                      <div style={{marginTop:10}}>
                        <Button onClick={createInvite} disabled={!canInvite}>Generate code</Button>
                        {!canInvite ? <div style={{marginTop:6, fontSize:12, color:"#64748b"}}>Only Owner/Admin can invite.</div> : null}
                      </div>

                      {inviteCode ? (
                        <div style={{marginTop:10, border:"1px solid #0f172a", background:"#0f172a", color:"white", borderRadius:12, padding:"10px 12px", fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace"}}>
                          {inviteCode}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent style={{paddingTop:16}}>
                      <div style={{fontWeight:800}}>Join with invite code</div>
                      <div style={{marginTop:6, fontSize:12, color:"#64748b"}}>Teammate: sign in → paste code → join.</div>
                      <div style={{marginTop:10}}>
                        <Input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="e.g., 8F4A2B1C0D" />
                      </div>
                      <div style={{marginTop:10}}>
                        <Button variant="outline" onClick={redeemInvite}>Join</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card style={{gridColumn:"1 / -1"}}>
                    <CardContent style={{paddingTop:16}}>
                      <div style={{fontWeight:800}}>Members</div>
                      <div style={{marginTop:10, display:"grid", gap:8}}>
                        {members.length ? members.map(m=>(
                          <div key={m.user_id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #e2e8f0", background:"#fff", borderRadius:12, padding:"8px 10px"}}>
                            <div style={{fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{memberDisplay(m)}</div>
                            <Badge>{roleLabel(m.role)}</Badge>
                          </div>
                        )) : <div style={{fontSize:13, color:"#64748b"}}>No members loaded.</div>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div style={{marginTop:18, fontSize:12, color:"#64748b"}}>
          📌 Installable: once deployed to a URL, open on phone → “Add to Home Screen” / “Install app”.
        </div>
      </div>
    </div>
  );
}
