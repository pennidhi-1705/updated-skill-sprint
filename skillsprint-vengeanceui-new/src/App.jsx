import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { seedIfMissing, read, write } from "./services/storage";
import { getCurrentUser, login, logout, register } from "./services/authService";
import { getTasks, getTask, createTask, getPublishedTasks } from "./services/taskService";
import { createApplication, getApplications, updateApplicationStatus } from "./services/applicationService";
import { createProject, getProjects, getProject, getSubmission, reviewProject, saveSubmission } from "./services/projectService";
import { createOrganization, getOrganization, getOrganizations, submitVerification, reviewOrganization, isOrganizationVerified, updateMessageSettings, getAuditLogs } from "./services/organizationService";
import { calculateMatch } from "./services/matchingService";
import { analyzeSkillGaps, recommendNextTasks, recommendSkills, generateCareerRoadmap, generateProfileUpgrade, SKILL_CATEGORIES } from "./services/aiSkillGapService";
import { follow, unfollow, isFollowing, getFollowerCount, getFollowingForUser } from "./services/followService";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "./services/notificationService";
import { getConversationsForUser, getOrCreateConversation, canStudentMessageOrganization } from "./services/conversationService";
import { getMessages, sendMessage, markConversationRead } from "./services/chatService";
import HarryWidget from "./harry/HarryWidget";
import PopButton from "./components/vengeance/PopButton";
import FlipText from "./components/vengeance/FlipText";
import InteractiveParticles from "./components/vengeance/InteractiveParticles";
import HighlightGrid from "./components/vengeance/HighlightGrid";
import StackedCategories from "./components/vengeance/StackedCategories";
import MegaNav from "./components/vengeance/MegaNav";
import MorphText from "./components/vengeance/MorphText";
import ScrollProgressPath from "./components/vengeance/ScrollProgressPath";
import SocialFlipButton, { CompassIcon, BriefcaseIcon } from "./components/vengeance/SocialFlipButton";

seedIfMissing();

const Button = ({ children, variant="primary", ...p }) => <button className={`btn ${variant}`} {...p}>{children}</button>;
const Badge = ({ children, tone="neutral" }) => <span className={`badge ${tone}`}>{children}</span>;
const Card = ({ children, className="" }) => <section className={`card ${className}`}>{children}</section>;

function VerificationBadge({ org }) {
  const status = org?.verificationStatus || "Pending";
  if (status === "Verified") return <Badge tone="success">✓ Verified Organization</Badge>;
  if (status === "Verifying") return <Badge tone="accent">◷ Verification in Progress</Badge>;
  if (status === "Needs Attention") return <Badge tone="warn">⚠ Verification Needs Attention</Badge>;
  if (status === "Rejected") return <Badge tone="neutral">Verification Rejected</Badge>;
  return <Badge tone="neutral">Verification Pending</Badge>;
}

function FollowButton({ studentId, orgId }) {
  const [following, setFollowing] = useState(isFollowing(studentId, orgId, "organization"));
  function toggle() {
    if (following) { unfollow(studentId, orgId, "organization"); setFollowing(false); }
    else { follow(studentId, orgId, "organization"); setFollowing(true); }
  }
  return <Button variant={following ? "secondary" : "primary"} onClick={toggle}>{following ? "Following ✓" : "Follow"}</Button>;
}

function MessageButton({ studentId, orgId, label = "Message" }) {
  const nav = useNavigate();
  const [error, setError] = useState("");
  function open() {
    try { const c = getOrCreateConversation(studentId, orgId); nav(`/messages?c=${c.id}`); }
    catch (e) { setError(e.message); }
  }
  if (error) return <span className="hint">{error}</span>;
  return <Button variant="secondary" onClick={open}>{label}</Button>;
}

function NotificationBell() {
  const u = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const nav = useNavigate();
  if (!u) return null;
  const notifications = getNotifications(u.id).slice(0, 6);
  const unread = getUnreadCount(u.id);
  return <div className="notif-wrap">
    <button className="notif-bell" onClick={() => setOpen(o => !o)} aria-label="Notifications">
      🔔{unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div className="notif-dropdown">
      <div className="notif-dropdown-head"><b>Notifications</b>{unread > 0 && <button className="text-link small" onClick={() => { markAllRead(u.id); setVersion(v => v + 1); }}>Mark all read</button>}</div>
      {notifications.length ? notifications.map(n => <div key={n.id} className={`notif-item ${n.isRead ? "" : "unread"}`} onClick={() => { markRead(n.id); setVersion(v => v + 1); setOpen(false); nav("/notifications"); }}>
        <b>{n.title}</b><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small>
      </div>) : <div className="notif-empty">You're all caught up.</div>}
      <Link className="notif-viewall" to="/notifications" onClick={() => setOpen(false)}>View all →</Link>
    </div>}
  </div>;
}

function Layout({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const nav = useNavigate();
  const location = useLocation();
  useEffect(() => setUser(getCurrentUser()), [location.pathname]);
  useEffect(() => {
    function onUserChanged(e) { setUser(e.detail); }
    window.addEventListener("skillsprint:user-changed", onUserChanged);
    return () => window.removeEventListener("skillsprint:user-changed", onUserChanged);
  }, []);
  function doLogout() { logout(); setUser(null); nav("/"); }

  const navConfig = user?.role === "student" ? {
      explore: [
        { label: "How It Works", href: "/#how", desc: "See how discovery, verification and applying work." },
        { label: "Opportunities", to: "/opportunities", desc: "Find short real-world tasks that match your skills." },
        { label: "Organizations", to: "/organizations", desc: "Discover and follow verified organizations." },
        { label: "Network", to: "/network", desc: "Grow your professional connections." },
      ],
      quick: [{ label: "Messages", to: "/messages" }, { label: "Dashboard", to: "/student/dashboard" }],
    } : user?.role === "organization" ? {
      explore: [{ label: "How It Works", href: "/#how", desc: "See how discovery, verification and applying work." }],
      quick: [
        { label: "Dashboard", to: "/organization/dashboard" },
        { label: "Post a Task", to: "/organization/post-task" },
        { label: "Applications", to: "/organization/applications" },
        { label: "Messages", to: "/messages" },
        { label: "Verification", to: "/organization/verification" },
      ],
    } : user?.role === "admin" ? {
      explore: [{ label: "How It Works", href: "/#how", desc: "See how discovery, verification and applying work." }],
      quick: [{ label: "Internal Review", to: "/admin" }],
    } : {
      explore: [
        { label: "How It Works", href: "/#how", desc: "See how discovery, verification and applying work." },
        { label: "Organizations", to: "/organizations", desc: "Browse verified organizations posting real work." },
      ],
      quick: [{ label: "For Students", to: "/login?role=student" }, { label: "For Organizations", to: "/login?role=organization" }],
    };

  const brand = <Link className="brand" to="/">Skill<span>Sprint</span></Link>;
  const rightSlot = user ? <>
    {(user.role === "student" || user.role === "organization") && <NotificationBell/>}
    <span className="user-chip">{user.name} · {user.role}</span>
    <Button variant="ghost" onClick={doLogout}>Log out</Button>
  </> : <PopButton to="/login" variant="ghost" size="sm">Login</PopButton>;
  const mobileFoot = user ? <>
    <span className="user-chip">{user.name} · {user.role}</span>
    <PopButton variant="ghost" size="sm" onClick={doLogout}>Log out</PopButton>
  </> : <PopButton to="/login" size="sm">Login</PopButton>;

  return <div className="app-shell">
    <MegaNav brand={brand} nav={navConfig} rightSlot={rightSlot} mobileFoot={mobileFoot}/>
    <main>{children}</main>
    <footer className="footer"><div><strong>SkillSprint</strong><p>Small tasks. Real experience. Local impact.</p><div className="flip-social-row"><SocialFlipButton letter="F" label="Find a Project" icon={<CompassIcon/>} to="/opportunities"/><SocialFlipButton letter="P" label="Post a Task" icon={<BriefcaseIcon/>} to="/login?role=organization"/></div></div><div><Link to="/opportunities">Find a Project</Link><Link to="/login?role=organization">Post a Task</Link></div><small>Prototype • Built for a hackathon</small></footer>
    <HarryWidget/>
  </div>;
}

function DiscoverOrganizationsSection() {
  const orgs = getOrganizations().filter(o => o.verificationStatus === "Verified").slice(0, 3);
  if (!orgs.length) return null;
  return <section className="section alt">
    <div className="section-head"><div><div className="eyebrow">DISCOVER ORGANIZATIONS</div><h2>Trusted organizations, ready to connect.</h2></div><Link className="text-link" to="/organizations">Browse all →</Link></div>
    <div className="task-grid">{orgs.map(o => <Card key={o.id} className="org-card">
      <VerificationBadge org={o}/>
      <h3>{o.name}</h3>
      <p className="org-name">{o.organizationType || o.type} · {o.location}</p>
      <p className="detail-copy small">{o.description || "No description added yet."}</p>
      <div className="task-meta org-meta"><span>{getFollowerCount(o.id, "organization")} followers</span><span>{getTasks().filter(t => t.organizationId === o.id && (t.status === "Open" || t.status === "Published")).length} opportunities</span></div>
      <Link className="btn secondary full" to={`/organizations/${o.id}`}>View organization →</Link>
    </Card>)}</div>
  </section>;
}

function TrustSection() {
  return <section className="section">
    <div className="eyebrow">BUILT AROUND TRUST</div>
    <h2>Every organization on SkillSprint is checked before it can post.</h2>
    <div className="trust-grid">
      {[
        ["AI-Assisted Organization Verification", "Submitted organization details and documents are automatically checked for consistency before anything goes live."],
        ["Government Record Matching", "Where available, organization details are cross-checked against authoritative registries."],
        ["Verification Confidence, Not False Certainty", "We show a confidence score and route borderline cases to human review instead of guessing."],
        ["Secure In-Platform Messaging", "Conversations stay inside SkillSprint with permission rules that prevent spam."],
        ["Private Verification Documents", "Submitted documents and identity proofs are never shown publicly."],
        ["Internal Audit Trail", "Every verification action is logged for authorized platform staff."]
      ].map(([t, d]) => <Card key={t}><b>✓ {t}</b><p className="detail-copy small">{d}</p></Card>)}
    </div>
  </section>;
}

function ChatShowcaseSection() {
  return <section className="section alt">
    <div className="split">
      <div><div className="eyebrow">DIRECT COMMUNICATION</div><h2>Don't just apply. <MorphText words={["Connect.","Discover.","Grow."]}/></h2><p>When an organization is interested in your profile, you can continue the conversation directly inside SkillSprint — no switching to email or chat apps.</p><Link className="text-link" to="/login?role=student">Start connecting →</Link></div>
      <Card className="chat-preview">
        <div className="chat-preview-head"><VerificationBadge org={{verificationStatus:"Verified"}}/><b>ABC Technologies</b></div>
        <div className="chat-bubble theirs">Hi Priya, we liked your profile! Would you be available for a short discussion?</div>
        <div className="chat-bubble mine">Yes, absolutely!</div>
      </Card>
    </div>
  </section>;
}

function Home() {
  return <><section className="hero" style={{position:"relative",overflow:"hidden"}}>
      <InteractiveParticles density={50}/>
      <div className="hero-copy" style={{position:"relative",zIndex:1}}><Badge tone="accent">Where skills meet opportunity</Badge><h1>Small tasks.<br/><em>Real experience.</em><br/>Trusted connections.</h1><p>Discover verified organizations, find opportunities that match your skills, build meaningful professional connections, and grow your career — all in one place.</p><div className="hero-actions"><PopButton to="/opportunities">Explore Opportunities →</PopButton><PopButton to="/login?role=student" variant="ghost">Join SkillSprint</PopButton></div><div className="hero-proof"><span>✓ Verified organizations</span><span>✓ AI-assisted verification</span><span>✓ Direct messaging</span></div></div>
      <div className="hero-visual" style={{position:"relative",zIndex:1}}><div className="floating-card top"><span className="icon">✦</span><div><b>92% match</b><small>Frontend Developer · ABC Technologies ✓</small></div></div><div className="visual-panel"><div className="mini-label">YOUR NEXT SPRINT</div><h3>Community Data Cleanup</h3><p>Local Impact NGO ✓ · 1 day · Hybrid</p><div className="progress"><span style={{width:"87%"}}/></div><div className="visual-row"><Badge tone="success">Verified</Badge><strong>₹1,200</strong></div></div><div className="floating-card bottom"><span className="check">🎉</span><div><b>You're shortlisted</b><small>ABC Technologies wants to connect</small></div></div></div>
    </section>
    <HighlightGrid initialActive={0} items={[
      {icon:"🎓",label:"Students",sub:"Build real experience"},
      {icon:"⚡",label:"Opportunities",sub:"4-hour to 1-day tasks"},
      {icon:"🏢",label:"Organizations",sub:"Verified before they post"},
      {icon:"🧩",label:"Skills",sub:"Matched transparently"},
      {icon:"📁",label:"Projects",sub:"Tracked start to finish"},
      {icon:"✓",label:"Verification",sub:"AI-assisted, human-reviewed"},
      {icon:"💬",label:"Messaging",sub:"Stay inside SkillSprint"},
      {icon:"🌐",label:"Community",sub:"Local impact, real work"},
    ]}/>
    <section className="section problem"><div className="eyebrow">THE GAP</div><h2>Great opportunities are often too small — or too easy to fake — to trust.</h2><p className="lead">Traditional internship platforms focus on long-term placements with no way to verify who's actually on the other side. SkillSprint makes short, practical work visible, backed by verified organizations and direct communication.</p><StackedCategories items={["Website Update","Data Entry","Survey","Translation","Design","Technical Assistance"]}/></section>
    <section className="section alt" id="how"><ScrollProgressPath><div className="eyebrow">HOW SKILLSPRINT WORKS</div><h2>Discover → Verify → Connect → Apply → Collaborate → Grow.</h2><div className="flow">{["Build your profile","Discover opportunities","Follow organizations you trust","Apply & get shortlisted","Chat directly","Complete real work","Get reviewed","Verified experience"].map((x,i)=><div className="flow-step" key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b></div>)}</div></ScrollProgressPath></section>
    <DiscoverOrganizationsSection/>
    <section className="section split" id="students"><div><div className="eyebrow">FOR STUDENTS</div><h2>Build experience before you graduate.</h2><p>Show what you can actually do, discover projects that fit your skills, follow organizations you care about, and collect verified work instead of empty claims.</p><Link className="text-link" to="/login?role=student">Create student profile →</Link></div><Card><div className="metric">92%</div><b>Transparent match score</b><p>Skill, availability, location/work mode and experience are scored separately — no black box.</p></Card></section>
    <section className="section split reverse" id="organizations"><Card><div className="metric">01</div><b>Post one real task</b><p>The same saved task appears in your dashboard and the marketplace — no fake copies.</p></Card><div><div className="eyebrow">FOR ORGANIZATIONS</div><h2>Get focused help — and reach students who trust you.</h2><p>Get AI-assisted verification, publish opportunities that go live immediately, shortlist strong applicants, and message them directly inside SkillSprint.</p><Link className="text-link" to="/organization/register">For Organizations →</Link></div></section>
    <TrustSection/>
    <ChatShowcaseSection/>
    <section className="cta"><h2><FlipText duration={1.8} together={false}>Your skills can take you further.</FlipText></h2><p>Discover opportunities. Connect with organizations. Build real experience.</p><div className="button-row center"><PopButton to="/opportunities">Explore Opportunities</PopButton><PopButton to="/login?role=student" variant="ghost">Join SkillSprint</PopButton></div></section>
  </>;
}

function Field({ label, ...p }) { return <label className="field"><span>{label}</span><input {...p}/></label>; }
function Textarea({ label, ...p }) { return <label className="field"><span>{label}</span><textarea {...p}/></label>; }

function StudentRegister() {
  const nav=useNavigate(); const [error,setError]=useState("");
  const [f,setF]=useState({name:"",email:"",password:"",college:"",course:"",year:"",skills:"",location:"",availability:"Flexible",portfolio:"",bio:""});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  function submit(e){e.preventDefault();setError(""); if(!f.name||!f.email||!f.password||!f.college||!f.course||!f.skills||!f.location){setError("Please complete all required fields.");return;} try{register({...f,role:"student",skills:f.skills.split(",").map(s=>s.trim()).filter(Boolean),experienceScore:0});nav("/student/dashboard")}catch(e){setError(e.message)}}
  return <AuthShell title="Create your student profile" subtitle="Your details stay connected across your dashboard, applications and projects."><form onSubmit={submit} className="form-grid">
    <Field label="Full Name *" value={f.name} onChange={e=>set("name",e.target.value)} /><Field label="Email *" type="email" value={f.email} onChange={e=>set("email",e.target.value)}/><Field label="Password *" type="password" value={f.password} onChange={e=>set("password",e.target.value)}/><Field label="College *" value={f.college} onChange={e=>set("college",e.target.value)}/><Field label="Course *" value={f.course} onChange={e=>set("course",e.target.value)}/><Field label="Year" value={f.year} onChange={e=>set("year",e.target.value)}/><Field label="Skills * (comma separated)" value={f.skills} onChange={e=>set("skills",e.target.value)}/><Field label="Location *" value={f.location} onChange={e=>set("location",e.target.value)}/><label className="field"><span>Availability</span><select value={f.availability} onChange={e=>set("availability",e.target.value)}><option>Weekdays</option><option>Weekends</option><option>Both</option><option>Flexible</option></select></label><Field label="Portfolio URL" value={f.portfolio} onChange={e=>set("portfolio",e.target.value)}/><Textarea label="Short Bio" value={f.bio} onChange={e=>set("bio",e.target.value)} /><div className="form-actions"><Button>Create profile</Button></div></form>{error&&<div className="error">{error}</div>}<p className="center-note">Already registered? <Link to="/login">Log in</Link></p></AuthShell>;
}

const ORG_TYPES = ["Registered Business", "Startup", "NGO", "Educational Institution", "Government/Institutional Organization", "Other"];
const PROOF_OPTIONS_BY_TYPE = {
  "Registered Business": ["Certificate of Incorporation", "GST Registration Certificate", "MSME/Udyam Registration", "Other legally recognized business document"],
  "Startup": ["Startup Recognition Certificate", "Certificate of Incorporation", "GST Registration Certificate", "Other legally recognized business document"],
  "NGO": ["NGO Registration Certificate", "Trust/Society Registration", "Other government-recognized NGO documentation"],
  "Educational Institution": ["Institution Recognition/Affiliation Certificate", "Government/University Affiliation Proof", "Other official institutional documentation"],
  "Government/Institutional Organization": ["Government/Institutional Recognition Proof", "Other official institutional documentation"],
  "Other": ["Other legally recognized organizational document"]
};
const ID_PROOF_TYPES = ["PAN Card", "Aadhaar Card", "Other government-issued ID"];

function OrganizationRegister() {
  const nav=useNavigate(); const [error,setError]=useState("");
  const [f,setF]=useState({name:"",type:"Registered Business",contactPerson:"",email:"",password:"",location:"",website:"",description:"",proofDocumentType:PROOF_OPTIONS_BY_TYPE["Registered Business"][0],proofDocumentReference:"",identityProofType:ID_PROOF_TYPES[0],identityCertified:false});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  function onTypeChange(v){setF(x=>({...x,type:v,proofDocumentType:PROOF_OPTIONS_BY_TYPE[v][0]}))}
  function submit(e){
    e.preventDefault();setError("");
    if(!f.name||!f.email||!f.password||!f.contactPerson||!f.location){setError("Please complete all required fields.");return;}
    if(!f.proofDocumentReference||!f.identityCertified){setError("Please complete the organization verification section — it's required to protect students from fake organizations.");return;}
    try{
      const org=createOrganization({
        name:f.name, type:f.type, organizationType:f.type, contactPerson:f.contactPerson, email:f.email,
        location:f.location, website:f.website, description:f.description,
        businessProof:{type:f.proofDocumentType, reference:f.proofDocumentReference},
        verificationDocuments:[{type:f.proofDocumentType, reference:f.proofDocumentReference, submittedAt:new Date().toISOString()}],
        identityProofType:f.identityProofType, identityProofSubmitted:true
      });
      register({name:f.name,email:f.email,password:f.password,role:"organization",organizationId:org.id});
      nav("/organization/dashboard")
    }catch(e){setError(e.message)}
  }
  return <AuthShell title="Create an organization profile" subtitle="Post real work, review applicants and build trusted student outcomes."><form onSubmit={submit} className="form-grid">
    <Field label="Organization Name *" value={f.name} onChange={e=>set("name",e.target.value)}/>
    <label className="field"><span>Organization Type</span><select value={f.type} onChange={e=>onTypeChange(e.target.value)}>{ORG_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
    <Field label="Contact Person *" value={f.contactPerson} onChange={e=>set("contactPerson",e.target.value)}/>
    <Field label="Email *" type="email" value={f.email} onChange={e=>set("email",e.target.value)}/>
    <Field label="Password *" type="password" value={f.password} onChange={e=>set("password",e.target.value)}/>
    <Field label="Location *" value={f.location} onChange={e=>set("location",e.target.value)}/>
    <Field label="Website" value={f.website} onChange={e=>set("website",e.target.value)}/>
    <Textarea label="Description" value={f.description} onChange={e=>set("description",e.target.value)}/>
    <div className="verification-section">
      <div className="eyebrow">ORGANIZATION VERIFICATION</div>
      <p className="verification-copy">To protect students from fake organizations and fraudulent opportunities, SkillSprint requires organizations to submit valid government or legally recognized proof before any task can be published.</p>
      <label className="field"><span>Verification Document Type *</span><select value={f.proofDocumentType} onChange={e=>set("proofDocumentType",e.target.value)}>{(PROOF_OPTIONS_BY_TYPE[f.type]||PROOF_OPTIONS_BY_TYPE.Other).map(x=><option key={x}>{x}</option>)}</select></label>
      <Field label="Document Reference / Number *" placeholder="e.g. Certificate ID or registration number" value={f.proofDocumentReference} onChange={e=>set("proofDocumentReference",e.target.value)}/>
      <label className="field"><span>Authorized Representative ID Type *</span><select value={f.identityProofType} onChange={e=>set("identityProofType",e.target.value)}>{ID_PROOF_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" checked={f.identityCertified} onChange={e=>set("identityCertified",e.target.checked)}/><span>I certify that a valid, government-issued identity document for the authorized representative has been prepared and is being submitted for verification.</span></label>
      <p className="hint">For this prototype, identity document numbers are never displayed publicly — only a "Verification document submitted ✓" confirmation is shown. In production these would be encrypted and access-controlled.</p>
    </div>
    <div className="form-actions"><Button>Create organization</Button></div>
  </form>{error&&<div className="error">{error}</div>}</AuthShell>;
}

function AuthShell({title,subtitle,children}) { return <div className="page narrow"><Link className="back" to="/">← Back</Link><Card className="auth-card"><div className="eyebrow">SKILLSPRINT</div><h1>{title}</h1><p>{subtitle}</p>{children}</Card></div>; }

function Login() {
  const nav=useNavigate();
  const [params]=useSearchParams();
  const requestedRole=params.get("role");
  const current=getCurrentUser();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{
    if(current && (!requestedRole || current.role===requestedRole)){
      nav(current.role==="student"?"/student/dashboard":current.role==="organization"?"/organization/dashboard":"/admin",{replace:true});
    }
  },[]);
  function submit(e){
    e.preventDefault();
    try{
      const u=login(email,password);
      if(requestedRole && u.role!==requestedRole){
        logout();
        throw new Error(`This account is not registered as ${requestedRole}. Please use the correct role entry.`);
      }
      nav(u.role==="student"?"/student/dashboard":u.role==="organization"?"/organization/dashboard":"/admin",{replace:true});
    }catch(e){setError(e.message)}
  }
  const roleLabel=requestedRole==="student"?"Student":requestedRole==="organization"?"Organization":"";
  return <AuthShell title={roleLabel?`${roleLabel} Login`:"Welcome back"} subtitle={roleLabel?`Log in to your ${roleLabel.toLowerCase()} portal.`:"Use the account you created in this prototype."}><form onSubmit={submit}><Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/><Field label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><Button>Login</Button></form>{error&&<div className="error">{error}</div>}<div className="auth-links"><Link to="/student/register">Register as Student</Link><Link to="/organization/register">Register as Organization</Link></div></AuthShell>;
}

function Guard({role,children}) { const u=getCurrentUser(); if(!u)return <Navigate to="/login" replace/>; if(role&&u.role!==role)return <Navigate to="/not-found" replace/>; return children; }

function StudentDashboard() {
  const u=getCurrentUser(); const apps=getApplications().filter(a=>a.studentId===u.id); const projects=getProjects().filter(p=>p.studentId===u.id);
  const tasks=getPublishedTasks(); const recommended=[...tasks].sort((a,b)=>calculateMatch(u,b).total-calculateMatch(u,a).total).slice(0,3);
  return <Dashboard title={`Welcome, ${u.name}`} subtitle={`${u.college} · ${u.course}`}><div className="dashboard-grid"><Card><div className="eyebrow">PROFILE</div><h3>Profile completion</h3><div className="big-number">{Math.min(100,Math.round(([u.name,u.email,u.college,u.course,u.skills?.length,u.location,u.bio].filter(Boolean).length/7)*100))}%</div><p>{u.skills?.join(" · ")}</p><Link className="text-link" to="/student/profile">Edit profile →</Link></Card><Card><div className="eyebrow">ACTIVITY</div><h3>Applications</h3><div className="big-number">{apps.length}</div><p>{apps.filter(a=>a.status==="Selected").length} selected</p><Link className="text-link" to="/student/applications">View applications →</Link></Card><Card><div className="eyebrow">PROJECTS</div><h3>Active projects</h3><div className="big-number">{projects.filter(p=>p.status==="Active").length}</div><p>{projects.filter(p=>p.status==="Completed").length} completed</p><Link className="text-link" to="/student/projects">View projects →</Link></Card></div><section className="section compact"><div className="section-head"><div><div className="eyebrow">RECOMMENDED</div><h2>Opportunities for you</h2></div><Link className="text-link" to="/opportunities">See all →</Link></div><TaskGrid tasks={recommended} student={u}/></section><SkillGapSection student={u}/></Dashboard>;
}

// --------------------------- AI Skill Gap Radar ---------------------------

function RadarChart({categories}) {
  const size=320, center=size/2, maxR=size/2-46;
  const n=categories.length;
  const angleFor=i=>(Math.PI*2*i)/n - Math.PI/2;
  const pointFor=(i,value)=>{
    const r=(Math.max(0,Math.min(100,value))/100)*maxR;
    const a=angleFor(i);
    return [center + r*Math.cos(a), center + r*Math.sin(a)];
  };
  const ring=(frac)=>categories.map((_,i)=>{
    const a=angleFor(i); const r=maxR*frac;
    return `${center+r*Math.cos(a)},${center+r*Math.sin(a)}`;
  }).join(" ");
  const currentPts=categories.map((c,i)=>pointFor(i,c.current).join(",")).join(" ");
  const targetPts=categories.map((c,i)=>pointFor(i,c.target).join(",")).join(" ");
  return <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg" role="img" aria-label="Skill gap radar chart">
    {[0.25,0.5,0.75,1].map(f=><polygon key={f} points={ring(f)} className="radar-ring"/>)}
    {categories.map((c,i)=>{const [x,y]=pointFor(i,100);return <line key={c.name} x1={center} y1={center} x2={x} y2={y} className="radar-axis"/>;})}
    <polygon points={targetPts} className="radar-target"/>
    <polygon points={currentPts} className="radar-current"/>
    {categories.map((c,i)=>{
      const a=angleFor(i);
      const lx=center+(maxR+30)*Math.cos(a);
      const ly=center+(maxR+30)*Math.sin(a);
      return <text key={c.name} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="radar-label">{c.name}</text>;
    })}
  </svg>;
}

function SkillGapSection({student}) {
  const analysis = useMemo(()=>analyzeSkillGaps(student),[student]);
  const recommendedTasks = useMemo(()=>recommendNextTasks(student,analysis),[student,analysis]);
  const recommendedSkills = useMemo(()=>recommendSkills(student,analysis),[student,analysis]);
  const [showRoadmap,setShowRoadmap]=useState(false);
  const [upgrade,setUpgrade]=useState(null);
  const roadmap = useMemo(()=>generateCareerRoadmap(student,analysis,recommendedSkills,recommendedTasks),[student,analysis,recommendedSkills,recommendedTasks]);

  function runUpgrade(){
    setUpgrade(generateProfileUpgrade(student,analysis,recommendedSkills,recommendedTasks));
    setShowRoadmap(true);
  }

  return <section className="section compact skillgap-section">
    <div className="section-head"><div><div className="eyebrow">AI SKILL GAP RADAR</div><h2>Where you are vs. where you're headed</h2></div></div>

    <div className="skillgap-grid">
      <Card className="radar-card"><RadarChart categories={analysis.categories}/><div className="radar-legend"><span><i className="dot current"/>Current</span><span><i className="dot target"/>Target</span></div></Card>
      <Card>
        <div className="eyebrow">TOP SKILL GAPS</div>
        <h3>Your Top Skill Gaps</h3>
        {analysis.topGaps.length ? <ol className="gap-list">{analysis.topGaps.map(g=><li key={g.name}><div><b>{g.name}</b><span className={`gap-tag gap-${g.priority.toLowerCase()}`}>{g.priority} Gap</span></div><p>{g.current}% → {g.target}% target ({g.gap}% gap)</p></li>)}</ol> : <Empty text="No significant gaps detected — nice work."/>}
      </Card>
    </div>

    <div className="skillgap-grid">
      <Card>
        <div className="eyebrow">CURRENT PROFILE → TARGET PROFILE</div>
        <h3>Current Profile → Target Profile</h3>
        <div className="profile-flow">
          <div className="profile-flow-step"><b>{analysis.currentProfile.headline}</b><ul>{analysis.currentProfile.points.map(p=><li key={p}>{p}</li>)}</ul></div>
          <div className="profile-flow-arrow">→</div>
          <div className="profile-flow-step"><b>Skills to Learn</b><ul>{recommendedSkills.slice(0,3).map(s=><li key={s.skill}>{s.skill}</li>)}</ul></div>
          <div className="profile-flow-arrow">→</div>
          <div className="profile-flow-step"><b>Recommended Tasks</b><ul>{recommendedTasks.length?recommendedTasks.slice(0,2).map(t=><li key={t.task.id}>{t.task.title}</li>):<li>Check back soon</li>}</ul></div>
          <div className="profile-flow-arrow">→</div>
          <div className="profile-flow-step target-step"><b>{analysis.targetProfile.headline}</b><ul>{analysis.targetProfile.points.map(p=><li key={p}>{p}</li>)}</ul></div>
        </div>
      </Card>
    </div>

    <div className="skillgap-grid">
      <Card>
        <div className="eyebrow">NEXT BEST TASKS</div>
        <h3>Your Next Best Tasks</h3>
        {recommendedTasks.length ? <div className="list">{recommendedTasks.map(r=><div className="list-row" key={r.task.id}><div><h4>{r.task.title}</h4><p>{r.reason}</p><p className="hint">Skills gained: {r.skillsGained.join(", ")} · Skill-gap improvement: +{r.improvement}%</p></div><Link className="btn secondary" to={`/opportunities/${r.task.id}`}>View task</Link></div>)}</div> : <Empty text="No published tasks match your gaps right now — check the marketplace soon."/>}
      </Card>
      <Card>
        <div className="eyebrow">SKILLS YOU SHOULD LEARN NEXT</div>
        <h3>AI Skill Recommendations</h3>
        {recommendedSkills.length ? <div className="list">{recommendedSkills.map(s=><div className="list-row" key={s.skill}><div><h4>{s.skill}</h4><p>{s.why}</p><p className="hint">Current {s.currentLevel}% → Target {s.targetLevel}% {s.relatedTasks.length?`· Related tasks: ${s.relatedTasks.join(", ")}`:""}</p></div></div>)}</div> : <Empty text="No new skill recommendations yet."/>}
      </Card>
    </div>

    <Card className="upgrade-card">
      <div className="eyebrow">AI CAREER / PROFILE UPGRADE</div>
      <div className="upgrade-head"><h3>Upgrade My Profile with AI</h3><Button onClick={runUpgrade}>Upgrade My Profile with AI</Button></div>
      {upgrade && <p className="detail-copy">{upgrade}</p>}
      {showRoadmap && <>
        <h4>Recommended 30-Day Skill Roadmap</h4>
        <div className="roadmap">{roadmap.map(r=><div className="roadmap-step" key={r.week}><span className="roadmap-week">{r.week}</span><b>{r.stage}</b><p>{r.detail}</p></div>)}</div>
      </>}
    </Card>
  </section>;
}

function Dashboard({title,subtitle,children}) { return <div className="page dashboard-page"><div className="dashboard-head"><div><div className="eyebrow">DASHBOARD</div><h1>{title}</h1><p>{subtitle}</p></div></div>{children}</div>; }

const TARGET_ROLES = ["AI/ML Developer", "Full-Stack Developer", "Data Analyst", "Backend Developer", "Frontend Developer", "Product / Business Analyst"];

function StudentProfile(){
  const u=getCurrentUser();
  const [name,setName]=useState(u.name||"");
  const [college,setCollege]=useState(u.college||"");
  const [course,setCourse]=useState(u.course||"");
  const [year,setYear]=useState(u.year||"");
  const [location,setLocation]=useState(u.location||"");
  const [availability,setAvailability]=useState(u.availability||"Flexible");
  const [portfolio,setPortfolio]=useState(u.portfolio||"");
  const [skills,setSkills]=useState(u.skills||[]);
  const [skillInput,setSkillInput]=useState("");
  const [bio,setBio]=useState(u.bio||"");
  const [targetRole,setTargetRole]=useState(u.targetRole||"");
  const [targetSkills,setTargetSkills]=useState((u.targetSkills||[]).join(", "));
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");

  function addSkill(){
    const v=skillInput.trim();
    if(!v)return;
    if(skills.some(s=>s.toLowerCase()===v.toLowerCase())){setSkillInput("");return;}
    setSkills([...skills,v]);
    setSkillInput("");
    setSaved(false);
  }
  function removeSkill(s){setSkills(skills.filter(x=>x!==s));setSaved(false);}

  function save(){
    if(!name.trim()||!college.trim()||!course.trim()||!location.trim()||!skills.length){
      setError("Name, college, course, location and at least one skill are required.");
      setSaved(false);
      return;
    }
    setError("");
    const patch={
      name:name.trim(), college:college.trim(), course:course.trim(), year:year.trim(),
      location:location.trim(), availability, portfolio:portfolio.trim(),
      skills, bio,
      targetRole:targetRole||undefined,
      targetSkills:targetSkills.split(",").map(s=>s.trim()).filter(Boolean)
    };
    const users=read("users",[]).map(x=>x.id===u.id?{...x,...patch}:x);
    write("users",users);
    write("currentUser",{...u,...patch});
    setSaved(true);
  }

  return <Dashboard title="My profile" subtitle="The same profile powers matching, the Skill Gap Radar, and appears across your experience.">
    <Card>
      <div className="profile-header"><div className="avatar">{(name||u.name)?.[0]}</div><div><h2>{name||u.name}</h2><p>{college||u.college} · {course||u.course} · {location||u.location}</p></div></div>
      <div className="form-grid">
        <Field label="Full Name" value={name} onChange={e=>setName(e.target.value)}/>
        <Field label="College" value={college} onChange={e=>setCollege(e.target.value)}/>
        <Field label="Course" value={course} onChange={e=>setCourse(e.target.value)}/>
        <Field label="Year" value={year} onChange={e=>setYear(e.target.value)}/>
        <Field label="Location" value={location} onChange={e=>setLocation(e.target.value)}/>
        <label className="field"><span>Availability</span><select value={availability} onChange={e=>setAvailability(e.target.value)}><option>Weekdays</option><option>Weekends</option><option>Both</option><option>Flexible</option></select></label>
        <Field label="Portfolio URL" value={portfolio} onChange={e=>setPortfolio(e.target.value)}/>
      </div>
      <div className="eyebrow" style={{marginTop:6}}>SKILLS</div>
      <p className="hint">These skills power your task match score — add or remove skills to update your matches everywhere on SkillSprint.</p>
      <div className="tag-row skill-editor">
        {skills.map(s=><span key={s} className="skill-chip">{s}<button type="button" aria-label={`Remove ${s}`} onClick={()=>removeSkill(s)}>×</button></span>)}
        {!skills.length && <span className="hint">No skills added yet.</span>}
      </div>
      <div className="skill-add-row">
        <input placeholder="e.g. React, SQL, Communication" value={skillInput} onChange={e=>setSkillInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSkill();}}}/>
        <Button variant="secondary" onClick={addSkill}>Add skill</Button>
      </div>
      <Textarea label="Short Bio" value={bio} onChange={e=>setBio(e.target.value)}/>
      <div className="eyebrow" style={{marginTop:20}}>CAREER GOALS</div>
      <label className="field"><span>Target Role / Career Goal</span><select value={targetRole} onChange={e=>setTargetRole(e.target.value)}><option value="">Not sure yet</option>{TARGET_ROLES.map(x=><option key={x}>{x}</option>)}</select></label>
      <Field label="Target Skills (comma separated, optional)" value={targetSkills} onChange={e=>setTargetSkills(e.target.value)} placeholder="e.g. Machine Learning, SQL, Git"/>
      <Button onClick={save}>Save Changes</Button>
      {saved&&<p className="success-text">Profile updated successfully.</p>}
      {error&&<div className="error">{error}</div>}
    </Card>
  </Dashboard>;
}

function TaskGrid({tasks,student,role}) { if(!tasks.length)return <Empty text="No opportunities found."/>; return <div className="task-grid">{tasks.map(t=><TaskCard key={t.id} task={t} student={student} role={role}/>)}</div>; }
function TaskCard({task,student,role}) { const org=getOrganization(task.organizationId); const match=student?calculateMatch(student,task):null; return <Card className="task-card"><div className="task-top"><VerificationBadge org={org}/><span>{task.workMode}</span></div><h3>{task.title}</h3><p className="org-name">{org?.name||"Organization"}</p><div className="tag-row">{task.requiredSkills.map(s=><span className="tag" key={s}>{s}</span>)}</div><div className="task-meta"><span>◷ {task.duration}</span><span>⌖ {task.location}</span><strong>{task.reward}</strong></div>{match&&<div className="match-line"><b>{match.total}% match</b><span>based on your profile</span></div>}<Link className="btn secondary full" to={`/opportunities/${task.id}`}>View task →</Link></Card>; }

function Opportunities(){const u=getCurrentUser();if(u?.role && u.role!=="student")return <Navigate to={u.role==="organization"?"/organization/dashboard":"/admin"} replace/>;const [q,setQ]=useState("");const [mode,setMode]=useState("All");const tasks=useMemo(()=>getPublishedTasks().filter(t=>!q||[t.title,t.description,...t.requiredSkills,t.location].join(" ").toLowerCase().includes(q.toLowerCase())).filter(t=>mode==="All"||t.workMode===mode),[q,mode]);return <div className="page"><div className="market-head"><div><div className="eyebrow">MARKETPLACE</div><h1>Find your next sprint.</h1><p>Short projects with clear scope, transparent requirements and verified organizations.</p></div></div><div className="filters"><input placeholder="Search tasks, skills or locations…" value={q} onChange={e=>setQ(e.target.value)}/>{["All","Remote","On-site","Hybrid"].map(x=><button key={x} className={mode===x?"filter active":"filter"} onClick={()=>setMode(x)}>{x}</button>)}</div><TaskGrid tasks={tasks} student={u?.role==="student"?u:null}/></div>}

function TaskDetails(){const {taskId}=useParams();const task=getTask(taskId);const u=getCurrentUser();if(u?.role && u.role!=="student")return <Navigate to={u.role==="organization"?"/organization/dashboard":"/admin"} replace/>;if(!task)return <NotFound title="Task Not Found" back="/opportunities" label="Back to Opportunities"/>;const org=getOrganization(task.organizationId);const match=u?.role==="student"?calculateMatch(u,task):null;return <div className="page"><Link className="back" to="/opportunities">← Back to Opportunities</Link><div className="detail-grid"><Card><div className="task-top"><VerificationBadge org={org}/><span>{task.workMode}</span></div><h1>{task.title}</h1><p className="org-name">{org?.name} · {task.location}</p><p className="detail-copy">{task.description}</p><h3>Deliverables</h3><ul className="clean-list">{task.deliverables.map(d=><li key={d}>✓ {d}</li>)}</ul><h3>Required skills</h3><div className="tag-row">{task.requiredSkills.map(s=><Badge key={s}>{s}</Badge>)}</div></Card><aside><Card><div className="eyebrow">PROJECT SNAPSHOT</div><div className="snapshot"><b>{task.duration}</b><span>Duration</span><b>{task.deadline}</b><span>Deadline</span><b>{task.reward}</b><span>Reward</span><b>{task.location}</b><span>Location</span></div>{match&&<><hr/><div className="match-score">{match.total}%<small>match</small></div><p>{match.reasons.join(" ")}</p></>}{u?.role==="student"&&getPublishedTasks().some(t=>t.id===task.id)?<Link className="btn primary full" to={`/opportunities/${task.id}/apply`}>Apply Now</Link>:u?.role==="student"?<Button disabled variant="secondary">Applications closed</Button>:<Link className="btn secondary full" to="/login?role=student">Log in as a student to apply</Link>}</Card></aside></div></div>}

function OrganizationTaskDetails(){const {taskId}=useParams();const task=getTask(taskId);const u=getCurrentUser();if(!task||task.organizationId!==u?.organizationId)return <NotFound title="Task Not Found" back="/organization/dashboard" label="Back to Dashboard"/>;const org=getOrganization(task.organizationId);const applications=getApplications().filter(a=>a.taskId===task.id&&a.organizationId===u.organizationId);return <div className="page"><Link className="back" to="/organization/dashboard">← Back to Dashboard</Link><div className="detail-grid"><Card><div className="task-top"><Badge tone={task.status==="Published"||task.status==="Open"?"success":"neutral"}>{task.status}</Badge><VerificationBadge org={org}/><span>{task.workMode}</span></div><h1>{task.title}</h1><p className="org-name">{org?.name} · {task.location}</p><p className="detail-copy">{task.description}</p><h3>Deliverables</h3><ul className="clean-list">{task.deliverables?.map(d=><li key={d}>✓ {d}</li>)}</ul><h3>Required skills</h3><div className="tag-row">{task.requiredSkills?.map(s=><Badge key={s}>{s}</Badge>)}</div></Card><aside><Card><div className="eyebrow">TASK SNAPSHOT</div><div className="snapshot"><b>{task.duration}</b><span>Duration</span><b>{task.deadline}</b><span>Deadline</span><b>{task.reward}</b><span>Reward</span><b>{applications.length}</b><span>Applications</span></div><Link className="btn primary full" to="/organization/applications">View applications</Link></Card></aside></div></div>}

function Apply(){const {taskId}=useParams();const task=getTask(taskId);const u=getCurrentUser();const nav=useNavigate();const [message,setMessage]=useState("");const [portfolio,setPortfolio]=useState(u?.portfolio||"");const [error,setError]=useState("");if(!task)return <NotFound title="Task Not Found" back="/opportunities" label="Back to Opportunities"/>;if(!u||u.role!=="student")return <Navigate to="/login" replace/>;function submit(e){e.preventDefault();try{createApplication({taskId,studentId:u.id,message,portfolio});nav("/student/applications")}catch(e){setError(e.message)}}return <div className="page narrow"><Link className="back" to={`/opportunities/${taskId}`}>← Back to Task</Link><Card><div className="eyebrow">APPLICATION</div><h1>Apply to {task.title}</h1><p>Applying as <b>{u.name}</b>. Your profile and match score are attached to this application.</p><Textarea label="Short introduction" value={message} onChange={e=>setMessage(e.target.value)} required/><Field label="Portfolio link" value={portfolio} onChange={e=>setPortfolio(e.target.value)}/><Button onClick={submit}>Submit application</Button>{error&&<div className="error">{error}</div>}</Card></div>}

function StudentApplications(){const u=getCurrentUser();const apps=getApplications().filter(a=>a.studentId===u.id);return <Dashboard title="My applications" subtitle="Track every application you submitted."><div className="list">{apps.length?apps.map(a=>{const t=getTask(a.taskId);const org=getOrganization(a.organizationId);return <Card key={a.id} className="list-row"><div><Badge tone={a.status==="Selected"||a.status==="Shortlisted"?"success":a.status==="Rejected"?"neutral":"accent"}>{a.status}</Badge><h3>{t?.title||"Task unavailable"}</h3><p>{org?.name} · Match score: {a.matchScore}% · Applied {new Date(a.appliedAt).toLocaleDateString()}</p></div><div className="stack">{t&&<Link className="btn secondary" to={`/opportunities/${t.id}`}>View task</Link>}<MessageButton studentId={u.id} orgId={a.organizationId}/></div></Card>}):<Empty text="No applications yet."/>}</div></Dashboard>}

function StudentProjects(){const u=getCurrentUser();const projects=getProjects().filter(p=>p.studentId===u.id);return <Dashboard title="My projects" subtitle="Your active and completed real-world work."><div className="list">{projects.length?projects.map(p=><ProjectRow key={p.id} p={p} role="student"/>):<Empty text="No active projects."/>}</div></Dashboard>}
function ProjectRow({p,role}){const t=getTask(p.taskId);return <Card className="list-row"><div><Badge tone={p.status==="Completed"?"success":"accent"}>{p.status}</Badge><h3>{t?.title||"Project not found"}</h3><p>{t?.organizationId&&getOrganization(t.organizationId)?.name} · {t?.deadline||"—"}</p></div><Link className="btn secondary" to={`/${role}/projects/${p.id}`}>Open workspace</Link></Card>}

function OrganizationDashboard(){
  const u=getCurrentUser();
  const org=getOrganization(u.organizationId);
  const tasks=getTasks().filter(t=>t.organizationId===u.organizationId);
  const apps=getApplications().filter(a=>(a.organizationId ? a.organizationId===u.organizationId : tasks.some(t=>t.id===a.taskId)));
  const draftCount=tasks.filter(t=>t.status==="Draft").length;
  const verified=isOrganizationVerified(org);
  return <Dashboard title={org?.name||u.name} subtitle={`${org?.type||"Organization"} · ${org?.location||u.location}`}>
    {!verified && <Card className="notice-card"><VerificationBadge org={org}/>{(org?.verificationStatus==="Rejected"||org?.verificationStatus==="Needs Attention")?<p>Your organization verification needs attention. <Link className="text-link" to="/organization/verification">Review and resubmit →</Link></p>:<p>Your organization verification is currently in progress. You can post draft tasks, but nothing publishes to students until verification is complete. <Link className="text-link" to="/organization/verification">View verification status →</Link></p>}</Card>}
    <div className="dashboard-grid">
      <Card><div className="eyebrow">VERIFICATION</div><h3>Status</h3><div className="big-number small">{org?.verificationStatus||"Pending"}</div><Link className="text-link" to="/organization/verification">Manage verification →</Link></Card>
      <Card><div className="eyebrow">TASKS</div><h3>Posted tasks</h3><div className="big-number">{tasks.length}</div>{draftCount>0&&<p className="hint">{draftCount} in draft (unpublished)</p>}<Link className="text-link" to="/organization/post-task">Post another →</Link></Card>
      <Card><div className="eyebrow">APPLICATIONS</div><h3>Applicants</h3><div className="big-number">{apps.length}</div><Link className="text-link" to="/organization/applications">Review applicants →</Link></Card>
    </div>
    <section className="section compact"><div className="section-head"><h2>My Tasks</h2><Link className="text-link" to="/organization/post-task">+ New task</Link></div>{tasks.length?<TaskGrid tasks={tasks} role="organization"/>:<Empty text="No tasks yet. Post your first task."/>}</section>
  </Dashboard>;
}

function OrganizationProfile(){
  const u=getCurrentUser();const o=getOrganization(u.organizationId);
  const [settings,setSettings]=useState(o?.messageSettings||"applicants");
  const [saved,setSaved]=useState(false);
  function saveSettings(v){setSettings(v);updateMessageSettings(u.organizationId,v);setSaved(true);}
  return <Dashboard title="Organization profile" subtitle="Verification, public profile and messaging settings.">
    <Card><div className="profile-header"><div className="avatar">{o?.name?.[0]}</div><div><h2>{o?.name}</h2><p>{o?.type} · {o?.location}</p></div></div><VerificationBadge org={o}/><p className="detail-copy">{o?.description||"No description added."}</p><dl className="definition"><dt>Contact</dt><dd>{o?.contactPerson}</dd><dt>Email</dt><dd>{o?.email}</dd><dt>Website</dt><dd>{o?.website||"—"}</dd><dt>Verification document</dt><dd>{o?.businessProof?"Verification document submitted ✓":"Not submitted"}</dd><dt>Identity verification</dt><dd>{o?.identityProofSubmitted?"Identity verification submitted ✓":"Not submitted"}</dd><dt>Followers</dt><dd>{getFollowerCount(u.organizationId,"organization")}</dd></dl>
      <div className="button-row"><Link className="text-link" to="/organization/verification">Manage verification →</Link><Link className="text-link" to={`/organizations/${u.organizationId}`}>View public profile →</Link></div>
    </Card>
    <Card><div className="eyebrow">MESSAGE SETTINGS</div><h3>Who can message us?</h3><div className="radio-group">
      <label className="checkbox-field"><input type="radio" checked={settings==="applicants"} onChange={()=>saveSettings("applicants")}/><span>Applicants only (recommended)</span></label>
      <label className="checkbox-field"><input type="radio" checked={settings==="applicants_and_followers"} onChange={()=>saveSettings("applicants_and_followers")}/><span>Applicants and followers</span></label>
      <label className="checkbox-field"><input type="radio" checked={settings==="anyone"} onChange={()=>saveSettings("anyone")}/><span>Anyone on SkillSprint</span></label>
    </div>{saved&&<p className="success-text">Message settings updated.</p>}</Card>
  </Dashboard>;
}

function PublicOrganizationProfile(){
  const {orgId}=useParams();
  const o=getOrganization(orgId);
  const u=getCurrentUser();
  const [version,setVersion]=useState(0);
  if(!o) return <NotFound title="Organization Not Found" back="/organizations" label="Back to Organizations"/>;
  const tasks=getPublishedTasks().filter(t=>t.organizationId===o.id);
  const following=u?.role==="student"&&isFollowing(u.id,o.id,"organization");
  return <div className="page">
    <Link className="back" to="/organizations">← Back to Organizations</Link>
    <div className="org-profile-head">
      <div className="avatar large">{o.name?.[0]}</div>
      <div><h1>{o.name}</h1><VerificationBadge org={o}/><p className="org-name">{o.organizationType||o.type} · {o.location}</p></div>
      <div className="button-row">
        {u?.role==="student"&&<FollowButton studentId={u.id} orgId={o.id}/>}
        {u?.role==="student"&&canStudentMessageOrganization(u.id,o.id)&&<MessageButton studentId={u.id} orgId={o.id}/>}
        {!u&&<Link className="btn secondary" to="/login?role=student">Log in to follow/message</Link>}
      </div>
      <div className="snapshot org-snapshot"><b>{getFollowerCount(o.id,"organization")}</b><span>Followers</span><b>{tasks.length}</b><span>Open Opportunities</span></div>
    </div>
    <Card><div className="eyebrow">ABOUT</div><p className="detail-copy">{o.description||"No description added yet."}</p>{o.website&&<p><a className="text-link" href={o.website} target="_blank" rel="noreferrer">{o.website}</a></p>}</Card>
    <section className="section compact"><div className="eyebrow">OPEN OPPORTUNITIES</div><h2>Opportunities from {o.name}</h2>{tasks.length?<TaskGrid tasks={tasks} student={u?.role==="student"?u:null}/>:<Empty text="No open opportunities right now."/>}</section>
  </div>;
}

function Organizations(){
  const [q,setQ]=useState("");
  const orgs=useMemo(()=>getOrganizations().filter(o=>o.verificationStatus==="Verified").filter(o=>!q||[o.name,o.organizationType,o.location,o.description].join(" ").toLowerCase().includes(q.toLowerCase())),[q]);
  return <div className="page"><div className="market-head"><div className="eyebrow">ORGANIZATIONS</div><h1>Discover verified organizations.</h1><p>Every organization here has passed AI-assisted verification.</p></div>
    <div className="filters"><input placeholder="Search organizations, industries or locations…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {orgs.length?<div className="task-grid">{orgs.map(o=><Card key={o.id} className="org-card"><VerificationBadge org={o}/><h3>{o.name}</h3><p className="org-name">{o.organizationType||o.type} · {o.location}</p><p className="detail-copy small">{o.description||"No description added yet."}</p><div className="task-meta org-meta"><span>{getFollowerCount(o.id,"organization")} followers</span><span>{getTasks().filter(t=>t.organizationId===o.id&&(t.status==="Open"||t.status==="Published")).length} opportunities</span></div><Link className="btn secondary full" to={`/organizations/${o.id}`}>View organization →</Link></Card>)}</div>:<Empty text="No organizations found."/>}
  </div>;
}

function Network(){
  const u=getCurrentUser();
  const followingIds=getFollowingForUser(u.id,"organization");
  const orgs=followingIds.map(id=>getOrganization(id)).filter(Boolean);
  return <Dashboard title="My Network" subtitle="Organizations you follow.">
    <section className="section compact"><div className="eyebrow">FOLLOWING</div><h2>Organizations</h2>{orgs.length?<div className="task-grid">{orgs.map(o=><Card key={o.id} className="org-card"><VerificationBadge org={o}/><h3>{o.name}</h3><p className="org-name">{o.organizationType||o.type} · {o.location}</p><Link className="btn secondary full" to={`/organizations/${o.id}`}>View organization →</Link></Card>)}</div>:<Empty text="You're not following any organizations yet."/>}
      {!orgs.length&&<Link className="text-link" to="/organizations">Discover organizations →</Link>}
    </section>
  </Dashboard>;
}

function VerificationStatusCopy({status}){
  if(status==="Verified") return <p className="success-text">✓ Verified Organization — you can publish tasks to the student marketplace.</p>;
  if(status==="Verifying") return <p>We're checking your organization information and submitted documents.</p>;
  if(status==="Needs Attention") return <p className="error-text">Some information doesn't match available records. Review the details below and resubmit.</p>;
  if(status==="Rejected") return <p className="error-text">Verification was rejected. See the reason below and resubmit.</p>;
  return <p>Verification submitted — awaiting the automated verification check.</p>;
}

function VerificationConfidencePanel({org}){
  if(!org.aiVerification) return null;
  const ai=org.aiVerification, gov=org.governmentVerification;
  return <Card>
    <div className="eyebrow">AI-ASSISTED VERIFICATION</div>
    <h3>Verification Confidence: {org.verificationConfidence ?? 0}%</h3>
    <p className="hint">AI-assisted analysis of submitted information — not a guarantee of document authenticity.</p>
    <dl className="definition">
      <dt>Organization Name Match</dt><dd>{ai.organizationNameMatch}%</dd>
      <dt>Registration Number Match</dt><dd>{ai.registrationNumberMatch}%</dd>
      <dt>Address Match</dt><dd>{ai.addressMatch}%</dd>
      <dt>Government Record</dt><dd>{gov?.governmentRecordFound?`✓ Matched (${gov.provider})`:`Not found (${gov?.provider||"mock provider"})`}</dd>
    </dl>
    {ai.warnings?.length>0 && <><div className="eyebrow">WARNINGS</div><ul className="clean-list">{ai.warnings.map(w=><li key={w}>⚠ {w}</li>)}</ul></>}
  </Card>;
}

function OrganizationVerification(){
  const u=getCurrentUser();
  const o=getOrganization(u.organizationId);
  const [f,setF]=useState({organizationType:o?.organizationType||o?.type||"Registered Business",proofDocumentType:(PROOF_OPTIONS_BY_TYPE[o?.organizationType||o?.type]||PROOF_OPTIONS_BY_TYPE.Other)[0],proofDocumentReference:o?.businessProof?.reference||"",identityProofType:o?.identityProofType||ID_PROOF_TYPES[0],identityCertified:Boolean(o?.identityProofSubmitted)});
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  function onTypeChange(v){setF(x=>({...x,organizationType:v,proofDocumentType:(PROOF_OPTIONS_BY_TYPE[v]||PROOF_OPTIONS_BY_TYPE.Other)[0]}))}
  function resubmit(e){
    e.preventDefault();setError("");setSaved(false);
    if(!f.proofDocumentReference||!f.identityCertified){setError("Please complete every verification field before resubmitting.");return;}
    submitVerification(o.id,{
      organizationType:f.organizationType,
      businessProof:{type:f.proofDocumentType, reference:f.proofDocumentReference},
      verificationDocuments:[...(o.verificationDocuments||[]),{type:f.proofDocumentType, reference:f.proofDocumentReference, submittedAt:new Date().toISOString()}],
      identityProofType:f.identityProofType,
      identityProofSubmitted:true
    });
    setSaved(true);
  }
  if(!o) return <Empty text="Organization not found."/>;
  return <Dashboard title="Organization verification" subtitle="Every opportunity on SkillSprint comes from an organization whose identity and legitimacy have been AI-assisted verified.">
    <div className="dashboard-grid">
      <Card><div className="eyebrow">STATUS</div><h3>{o.verificationStatus}</h3><VerificationStatusCopy status={o.verificationStatus}/></Card>
      <Card><div className="eyebrow">DOCUMENTS</div><h3>Verification document</h3><p>{o.businessProof?"Verification document submitted ✓":"Not submitted"}</p></Card>
      <Card><div className="eyebrow">IDENTITY</div><h3>Representative ID</h3><p>{o.identityProofSubmitted?"Identity verification submitted ✓":"Not submitted"}</p></Card>
    </div>
    <VerificationConfidencePanel org={o}/>
    {(o.verificationStatus==="Rejected"||o.verificationStatus==="Needs Attention") && o.verificationReason && <Card><div className="eyebrow">REASON</div><p>{o.verificationReason}</p></Card>}
    {(o.verificationStatus==="Rejected"||o.verificationStatus==="Needs Attention"||o.verificationStatus==="Pending") && <Card>
      <div className="eyebrow">{o.verificationStatus==="Pending"?"UPDATE VERIFICATION":"REVIEW DETAILS & RESUBMIT"}</div>
      <form onSubmit={resubmit} className="form-grid">
        <label className="field"><span>Organization Type</span><select value={f.organizationType} onChange={e=>onTypeChange(e.target.value)}>{ORG_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>Verification Document Type</span><select value={f.proofDocumentType} onChange={e=>set("proofDocumentType",e.target.value)}>{(PROOF_OPTIONS_BY_TYPE[f.organizationType]||PROOF_OPTIONS_BY_TYPE.Other).map(x=><option key={x}>{x}</option>)}</select></label>
        <Field label="Document Reference / Number" value={f.proofDocumentReference} onChange={e=>set("proofDocumentReference",e.target.value)}/>
        <label className="field"><span>Authorized Representative ID Type</span><select value={f.identityProofType} onChange={e=>set("identityProofType",e.target.value)}>{ID_PROOF_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="checkbox-field"><input type="checkbox" checked={f.identityCertified} onChange={e=>set("identityCertified",e.target.checked)}/><span>I certify a valid government-issued ID has been prepared for submission.</span></label>
        <div className="form-actions"><Button>Submit for review</Button></div>
      </form>
      {saved&&<p className="success-text">Verification resubmitted — the AI-assisted check has re-run automatically.</p>}
      {error&&<div className="error">{error}</div>}
    </Card>}
  </Dashboard>;
}

function PostTask(){const u=getCurrentUser();const org=getOrganization(u.organizationId);const verified=isOrganizationVerified(org);const nav=useNavigate();const [error,setError]=useState("");const [f,setF]=useState({title:"",description:"",requiredSkills:"",duration:"1 day",deadline:"",workMode:"Remote",location:"",reward:"",deliverables:""});const set=(k,v)=>setF(x=>({...x,[k]:v}));function submit(e){e.preventDefault();try{createTask({...f,organizationId:u.organizationId,requiredSkills:f.requiredSkills.split(",").map(x=>x.trim()).filter(Boolean),deliverables:f.deliverables.split(",").map(x=>x.trim()).filter(Boolean)});nav("/organization/dashboard")}catch(e){setError(e.message)}}return <div className="page narrow"><Link className="back" to="/organization/dashboard">← Dashboard</Link><Card><div className="eyebrow">NEW OPPORTUNITY</div><h1>Post a task</h1>{verified?<p>The saved task will appear in both your dashboard and the marketplace.</p>:<p className="notice-text">Your organization isn't verified yet, so this task will be saved as a <b>draft</b>. It will publish automatically to the student marketplace once verification is approved. <Link className="text-link" to="/organization/verification">Check verification status →</Link></p>}<form onSubmit={submit} className="form-grid"><Field label="Task Title *" required value={f.title} onChange={e=>set("title",e.target.value)}/><Textarea label="Description *" required value={f.description} onChange={e=>set("description",e.target.value)}/><Field label="Required Skills * (comma separated)" required value={f.requiredSkills} onChange={e=>set("requiredSkills",e.target.value)}/><Field label="Duration" value={f.duration} onChange={e=>set("duration",e.target.value)}/><Field label="Deadline" type="date" value={f.deadline} onChange={e=>set("deadline",e.target.value)}/><label className="field"><span>Work Mode</span><select value={f.workMode} onChange={e=>set("workMode",e.target.value)}>{["Remote","On-site","Hybrid"].map(x=><option key={x}>{x}</option>)}</select></label><Field label="Location" value={f.location} onChange={e=>set("location",e.target.value)}/><Field label="Reward" value={f.reward} onChange={e=>set("reward",e.target.value)}/><Textarea label="Deliverables (comma separated)" value={f.deliverables} onChange={e=>set("deliverables",e.target.value)}/><Button>{verified?"Publish task":"Save as draft"}</Button></form>{error&&<div className="error">{error}</div>}</Card></div>}

function OrganizationApplications(){
  const u=getCurrentUser();
  const [version,setVersion]=useState(0);
  const tasks=getTasks().filter(t=>t.organizationId===u.organizationId);
  const apps=getApplications().filter(a=>a.organizationId===u.organizationId&&tasks.some(t=>t.id===a.taskId));
  const nav=useNavigate();
  function shortlist(a){
    if(a.organizationId!==u.organizationId)return;
    updateApplicationStatus(a.id,"Shortlisted");
    setVersion(v=>v+1);
  }
  function select(a){
    const t=getTask(a.taskId);
    if(!t||t.organizationId!==u.organizationId||a.organizationId!==u.organizationId)return;
    createProject({taskId:a.taskId,studentId:a.studentId,organizationId:u.organizationId});
    updateApplicationStatus(a.id,"Selected");
    nav("/organization/projects");
  }
  function reject(a){
    if(a.organizationId!==u.organizationId)return;
    updateApplicationStatus(a.id,"Rejected");
    setVersion(v=>v+1);
  }
  return <Dashboard title="Applications" subtitle="Only applicants to your organization's tasks appear here.">
    <div className="list">
      {apps.length ? apps.map(a=>{
        const t=getTask(a.taskId);
        const s=read("users",[]).find(x=>x.id===a.studentId);
        return <Card key={a.id}>
          <div className="list-row">
            <div>
              <Badge tone={a.status==="Shortlisted"||a.status==="Selected"?"success":a.status==="Rejected"?"neutral":"accent"}>{a.status}</Badge>
              <h3>{s?.name||"Student not found"}</h3>
              <p>{t?.title} · {a.matchScore}% match</p>
              <p>{s?.college||"College not provided"} · {(s?.skills||[]).join(", ")}</p>
              <p>{a.message||"No introduction provided."}</p>
            </div>
            <div className="stack">
              {(a.status==="Pending"||a.status==="Shortlisted") && <>
                {a.status==="Pending" && <Button variant="secondary" onClick={()=>shortlist(a)}>Shortlist</Button>}
                <Button onClick={()=>select(a)}>Select student</Button>
                <Button variant="ghost" onClick={()=>reject(a)}>Reject</Button>
              </>}
              <MessageButton studentId={a.studentId} orgId={u.organizationId} label="Message"/>
            </div>
          </div>
        </Card>;
      }) : <Empty text="No applications yet."/>}
    </div>
  </Dashboard>;
}

function OrganizationProjects(){const u=getCurrentUser();const ps=getProjects().filter(p=>p.organizationId===u.organizationId);return <Dashboard title="Projects" subtitle="Selected students and their submissions."><div className="list">{ps.length?ps.map(p=><ProjectRow key={p.id} p={p} role="organization"/>):<Empty text="No active projects."/>}</div></Dashboard>}

function Workspace({role}){const {projectId}=useParams();const p=getProject(projectId);const u=getCurrentUser();if(!p)return <NotFound title="Project not found." back={`/${role}/projects`} label="Back to projects"/>;if((role==="student"&&p.studentId!==u.id)||(role==="organization"&&p.organizationId!==u.organizationId))return <NotFound title="Project not found." back={`/${role}/projects`} label="Back to projects"/>;const t=getTask(p.taskId);const student=read("users",[]).find(x=>x.id===p.studentId);const sub=getSubmission(p.id);return <div className="page"><Link className="back" to={`/${role}/projects`}>← Back to projects</Link><div className="detail-grid"><Card><Badge tone={p.status==="Completed"?"success":"accent"}>{p.status}</Badge><h1>{t?.title}</h1><p className="org-name">{getOrganization(p.organizationId)?.name} · {student?.name}</p><p className="detail-copy">{t?.description}</p><h3>Deliverables</h3><ul className="clean-list">{t?.deliverables?.map(d=><li key={d}>✓ {d}</li>)}</ul><div className="timeline"><span className="done">Selected</span><span className={sub?"done":""}>Work submitted</span><span className={p.status==="Completed"?"done":""}>Reviewed</span><span className={p.status==="Completed"?"done":""}>Verified experience</span></div></Card><aside><Card><div className="eyebrow">WORKSPACE</div><p><b>Deadline</b><br/>{t?.deadline}</p><p><b>Match score</b><br/>{read("applications",[]).find(a=>a.taskId===p.taskId&&a.studentId===p.studentId)?.matchScore||"—"}%</p>{role==="student"&&p.status==="Active"&&<Link className="btn primary full" to={`/student/projects/${p.id}/submit`}>{sub?"Update submission":"Submit Work"}</Link>}{role==="organization"&&<Link className="btn primary full" to={`/organization/projects/${p.id}/review`}>Review submission</Link>}{sub&&<div className="submission-preview"><Badge tone="success">{sub.status}</Badge><p>{sub.description}</p></div>}</Card></aside></div></div>}

function SubmitWork(){const {projectId}=useParams();const p=getProject(projectId);const u=getCurrentUser();const nav=useNavigate();const existing=p?getSubmission(projectId):null;const [desc,setDesc]=useState(existing?.description||"");const [file,setFile]=useState(existing?.fileUrl||"");const [link,setLink]=useState(existing?.resultUrl||"");if(!p||p.studentId!==u?.id)return <NotFound title="Project not found." back="/student/projects" label="Back to projects"/>;function submit(e){e.preventDefault();saveSubmission(projectId,{description:desc,fileUrl:file,resultUrl:link});nav(`/student/projects/${projectId}`)}return <div className="page narrow"><Link className="back" to={`/student/projects/${projectId}`}>← Back to workspace</Link><Card><div className="eyebrow">SUBMIT WORK</div><h1>Show what you built.</h1><form onSubmit={submit}><Textarea label="Description of result" required value={desc} onChange={e=>setDesc(e.target.value)}/><Field label="File metadata / filename" value={file} onChange={e=>setFile(e.target.value)} placeholder="Prototype: report.pdf"/><Field label="Result / portfolio link" value={link} onChange={e=>setLink(e.target.value)}/><Button>Submit work</Button></form><p className="hint">For this prototype, file metadata is stored locally. The data model is ready for real object storage later.</p></Card></div>}

function ReviewProject(){const {projectId}=useParams();const p=getProject(projectId);const u=getCurrentUser();const nav=useNavigate();const sub=getSubmission(projectId);const student=read("users",[]).find(x=>x.id===p?.studentId);const [feedback,setFeedback]=useState("");const [rating,setRating]=useState(5);if(!p||p.organizationId!==u?.organizationId)return <NotFound title="Project not found." back="/organization/projects" label="Back to projects"/>;function review(status){reviewProject(projectId,status,feedback);if(status==="Completed"){const reviews=read("reviews",[]);write("reviews",[...reviews,{id:`review_${Date.now()}`,projectId,rating:Number(rating),feedback,createdAt:new Date().toISOString()}]);}nav(`/organization/projects/${projectId}`)}return <div className="page narrow"><Link className="back" to={`/organization/projects/${projectId}`}>← Back to workspace</Link><Card><div className="eyebrow">REVIEW SUBMISSION</div><h1>{student?.name}'s work</h1>{sub?<><p className="detail-copy">{sub.description}</p><p><b>File:</b> {sub.fileUrl||"No file metadata supplied"}<br/><b>Result:</b> {sub.resultUrl||"—"}</p><Textarea label="Feedback" value={feedback} onChange={e=>setFeedback(e.target.value)}/><label className="field"><span>Rating</span><select value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(x=><option key={x}>{x}</option>)}</select></label><div className="button-row"><Button onClick={()=>review("Completed")}>Approve</Button><Button variant="secondary" onClick={()=>review("Changes Requested")}>Request changes</Button></div></>:<Empty text="No submission yet."/>}</Card></div>}

function AdminVerificationRow({org, onAction}){
  const [reason,setReason]=useState("");
  const [showLogs,setShowLogs]=useState(false);
  const logs=showLogs?getAuditLogs(org.id):[];
  return <Card className="verification-row">
    <div className="verification-row-head">
      <div>
        <VerificationBadge org={org}/>
        <h3>{org.name}</h3>
        <p>{org.organizationType||org.type} · {org.contactPerson} · {org.email}</p>
        <p>{org.website||"No website"} · {org.location}</p>
      </div>
      <div className="verification-meta">
        <span>Submitted: {org.verificationSubmittedAt?new Date(org.verificationSubmittedAt).toLocaleDateString():"—"}</span>
        {org.verificationReviewedAt && <span>Reviewed: {new Date(org.verificationReviewedAt).toLocaleDateString()}</span>}
        {org.verificationConfidence!=null && <span>AI Confidence: {org.verificationConfidence}%</span>}
        {org.governmentVerification && <span>Govt record: {org.governmentVerification.governmentRecordFound?"Matched":"Not found"}</span>}
      </div>
    </div>
    <div className="verification-docs">
      <span>{org.businessProof?`Document: ${org.businessProof.type} — Verification document submitted ✓`:"No document submitted"}</span>
      <span>{org.identityProofSubmitted?`Identity: ${org.identityProofType||"ID"} — Identity verification submitted ✓`:"No identity proof submitted"}</span>
    </div>
    {org.aiVerification?.warnings?.length>0 && <ul className="clean-list">{org.aiVerification.warnings.map(w=><li key={w} className="hint">⚠ {w}</li>)}</ul>}
    {org.verificationReason && <p className="hint">Last note: {org.verificationReason}</p>}
    {org.verificationStatus!=="Verified" && <div className="button-row">
      <Button onClick={()=>onAction(org.id,"approve")}>Approve</Button>
      <Button variant="secondary" onClick={()=>onAction(org.id,"reject",reason)}>Reject</Button>
      <Button variant="ghost" onClick={()=>onAction(org.id,"request_info",reason)}>Request more information</Button>
      <input className="reason-input" placeholder="Reason (for reject / request info)" value={reason} onChange={e=>setReason(e.target.value)}/>
    </div>}
    <button className="text-link small" onClick={()=>setShowLogs(s=>!s)}>{showLogs?"Hide":"View"} audit log →</button>
    {showLogs && <ul className="clean-list">{logs.length?logs.map(l=><li key={l.id} className="hint">{new Date(l.createdAt).toLocaleString()} — {l.action} ({l.performedBy}){l.metadata?.reason?`: ${l.metadata.reason}`:""}</li>):<li className="hint">No audit entries yet.</li>}</ul>}
  </Card>;
}

function Admin(){
  const [orgs,setOrgs]=useState(getOrganizations());
  function handleAction(id,action,reason){
    reviewOrganization(id,action,reason||"","internal-reviewer");
    setOrgs(getOrganizations());
  }
  const flagged=orgs.filter(o=>o.verificationStatus==="Needs Attention");
  const pending=orgs.filter(o=>o.verificationStatus!=="Verified"&&o.verificationStatus!=="Needs Attention");
  const verified=orgs.filter(o=>o.verificationStatus==="Verified");
  return <Dashboard title="Internal Verification & Trust Center" subtitle="Restricted to authorized platform personnel. Not linked from any student or organization navigation.">
    <Card><h2>Flagged for review (AI confidence below threshold)</h2>{flagged.length?<div className="list">{flagged.map(o=><AdminVerificationRow key={o.id} org={o} onAction={handleAction}/>)}</div>:<Empty text="No organizations currently flagged."/>}</Card>
    <Card><h2>Other unresolved cases</h2>{pending.length?<div className="list">{pending.map(o=><AdminVerificationRow key={o.id} org={o} onAction={handleAction}/>)}</div>:<Empty text="Nothing else pending."/>}</Card>
    <Card><h2>Verified organizations</h2>{verified.length?<div className="list">{verified.map(o=><div className="list-row" key={o.id}><div><VerificationBadge org={o}/><h3>{o.name}</h3><p>{o.organizationType||o.type} · {o.location} · AI confidence {o.verificationConfidence??"—"}%</p></div></div>)}</div>:<Empty text="No verified organizations yet."/>}</Card>
  </Dashboard>;
}

function ConversationPreview({c, otherLabel, active, onClick}){
  const org=getOrganization(c.organizationId);
  const student=read("users",[]).find(u=>u.id===c.studentId);
  const messages=getMessages(c.id);
  const last=messages[messages.length-1];
  return <div className={`conv-row ${active?"active":""}`} onClick={onClick}>
    <div className="avatar small">{(otherLabel||org?.name||student?.name||"?")[0]}</div>
    <div className="conv-row-body">
      <b>{otherLabel}</b>
      <p>{last?last.message.slice(0,60):"No messages yet."}</p>
    </div>
  </div>;
}

function Messages(){
  const u=getCurrentUser();
  const [params,setParams]=useSearchParams();
  const [version,setVersion]=useState(0);
  const [draft,setDraft]=useState("");
  const conversations=getConversationsForUser(u);
  const activeId=params.get("c")||conversations[0]?.id||null;
  const activeConv=conversations.find(c=>c.id===activeId)||null;
  useEffect(()=>{ if(activeConv){ markConversationRead(activeConv.id, u.role); } },[activeId,version]);
  function otherPartyLabel(c){
    if(u.role==="student") return getOrganization(c.organizationId)?.name||"Organization";
    const student=read("users",[]).find(x=>x.id===c.studentId);
    return student?.name||"Student";
  }
  function send(e){
    e.preventDefault();
    if(!activeConv||!draft.trim())return;
    sendMessage(activeConv.id,u,draft.trim());
    setDraft("");
    setVersion(v=>v+1);
  }
  return <div className="page dashboard-page">
    <div className="dashboard-head"><div><div className="eyebrow">MESSAGES</div><h1>Conversations</h1><p>Direct, in-platform communication — no need to leave SkillSprint.</p></div></div>
    <div className="chat-shell">
      <div className="conv-list">
        {conversations.length?conversations.map(c=><ConversationPreview key={c.id} c={c} otherLabel={otherPartyLabel(c)} active={c.id===activeId} onClick={()=>setParams({c:c.id})}/>):<Empty text="Start Building Connections 💬 — apply to an opportunity or follow an organization to start a conversation."/>}
      </div>
      <div className="chat-window">
        {activeConv?<>
          <div className="chat-window-head"><b>{otherPartyLabel(activeConv)}</b></div>
          <div className="chat-messages">
            {getMessages(activeConv.id).map(m=><div key={m.id} className={`chat-bubble ${m.senderRole===u.role?"mine":"theirs"}`}>{m.message}</div>)}
            {!getMessages(activeConv.id).length && <p className="hint">No messages yet — say hello.</p>}
          </div>
          <form className="chat-input-row" onSubmit={send}>
            <input placeholder="Type a message…" value={draft} onChange={e=>setDraft(e.target.value)}/>
            <Button>Send</Button>
          </form>
        </>:<Empty text="Select a conversation."/>}
      </div>
    </div>
  </div>;
}

function Notifications(){
  const u=getCurrentUser();
  const [version,setVersion]=useState(0);
  const notifications=getNotifications(u.id);
  return <Dashboard title="Notifications" subtitle="Everything relevant to your account, in one place.">
    {notifications.length>0 && <div className="button-row"><Button variant="ghost" onClick={()=>{markAllRead(u.id);setVersion(v=>v+1);}}>Mark all read</Button></div>}
    <div className="list">
      {notifications.length?notifications.map(n=><Card key={n.id} className={`list-row ${n.isRead?"":"unread-card"}`} onClick={()=>{markRead(n.id);setVersion(v=>v+1);}}>
        <div><b>{n.title}</b><p>{n.message}</p><small className="hint">{new Date(n.createdAt).toLocaleString()}</small></div>
      </Card>):<Empty text="Your Career Journey Starts Here 🚀 — notifications about applications, messages and opportunities will appear here."/>}
    </div>
  </Dashboard>;
}

function NotFound({title="Page Not Found",back="/",label="Back Home"}){return <div className="page not-found"><div className="eyebrow">404</div><h1>{title}</h1><p>The requested record or page does not exist.</p><Link className="btn primary" to={back}>{label}</Link></div>}
function Empty({text}){return <div className="empty"><div>○</div><b>{text}</b></div>}

export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/student/register" element={<StudentRegister/>}/><Route path="/organization/register" element={<OrganizationRegister/>}/><Route path="/opportunities" element={<Opportunities/>}/><Route path="/opportunities/:taskId" element={<TaskDetails/>}/><Route path="/opportunities/:taskId/apply" element={<Apply/>}/><Route path="/organizations" element={<Organizations/>}/><Route path="/organizations/:orgId" element={<PublicOrganizationProfile/>}/><Route path="/network" element={<Guard role="student"><Network/></Guard>}/><Route path="/messages" element={<Guard><Messages/></Guard>}/><Route path="/notifications" element={<Guard><Notifications/></Guard>}/><Route path="/student/dashboard" element={<Guard role="student"><StudentDashboard/></Guard>}/><Route path="/student/profile" element={<Guard role="student"><StudentProfile/></Guard>}/><Route path="/student/applications" element={<Guard role="student"><StudentApplications/></Guard>}/><Route path="/student/projects" element={<Guard role="student"><StudentProjects/></Guard>}/><Route path="/student/projects/:projectId" element={<Guard role="student"><Workspace role="student"/></Guard>}/><Route path="/student/projects/:projectId/submit" element={<Guard role="student"><SubmitWork/></Guard>}/><Route path="/organization/dashboard" element={<Guard role="organization"><OrganizationDashboard/></Guard>}/><Route path="/organization/profile" element={<Guard role="organization"><OrganizationProfile/></Guard>}/><Route path="/organization/verification" element={<Guard role="organization"><OrganizationVerification/></Guard>}/><Route path="/organization/post-task" element={<Guard role="organization"><PostTask/></Guard>}/><Route path="/organization/tasks/:taskId" element={<Guard role="organization"><OrganizationTaskDetails/></Guard>}/><Route path="/organization/applications" element={<Guard role="organization"><OrganizationApplications/></Guard>}/><Route path="/organization/projects" element={<Guard role="organization"><OrganizationProjects/></Guard>}/><Route path="/organization/projects/:projectId" element={<Guard role="organization"><Workspace role="organization"/></Guard>}/><Route path="/organization/projects/:projectId/review" element={<Guard role="organization"><ReviewProject/></Guard>}/><Route path="/admin" element={<Guard role="admin"><Admin/></Guard>}/><Route path="/not-found" element={<NotFound/>}/><Route path="*" element={<NotFound/>}/></Routes></Layout>}