import React, { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  Upload, Wrench, Users, Car, HardHat, TrendingUp, Award,
  Gauge, RefreshCw, Download, Search, Filter, ChevronLeft,
  ChevronRight, FileSpreadsheet, FileText, X, CheckCircle2,
  Activity, Eye, Phone, MapPin, Mail, BarChart2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//  GULF WAY GROUP — DARK THEME  (gulfwaygroup.ae)
//  Background: near-black  |  Accent: crimson red  |  Highlight: gold
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Backgrounds (dark hierarchy)
  bg:        "#0A0A0A",   // page background — deepest black
  surface:   "#111111",   // card / panel surface
  surfaceHi: "#1A1A1A",   // elevated card / hover
  surfaceBd: "#222222",   // table stripe / input bg

  // Brand
  red:       "#C8102E",   // Gulf Way primary red
  redDark:   "#9A0E26",   // hover / press
  redGlow:   "rgba(200,16,46,0.15)",  // glow backgrounds
  gold:      "#D4A017",   // premium accent
  goldLight: "#F0C040",   // highlight

  // Borders
  border:    "#2A2A2A",
  borderHi:  "#3A3A3A",

  // Text
  text:      "#F0F0F0",   // primary white text
  textSub:   "#A0A0A0",   // secondary / muted
  textDim:   "#606060",   // disabled / placeholder

  // Graph palette — 8 distinct professional colors
  g1: "#C8102E",   // Gulf Red       — primary series
  g2: "#D4A017",   // Gulf Gold      — secondary series
  g3: "#2E86C1",   // Steel Blue
  g4: "#1E8449",   // Emerald
  g5: "#884EA0",   // Royal Purple
  g6: "#CA6F1E",   // Amber
  g7: "#17A589",   // Teal
  g8: "#566573",   // Slate
};

const GRAPH_PALETTE = [T.g1, T.g2, T.g3, T.g4, T.g5, T.g6, T.g7, T.g8];

const CO = {
  name:    "Gulf Way Auto Service LLC",
  address: "5 4a St, Ras Al Khor Industrial Area 1, Dubai, UAE",
  phone:   "+971 50 605 0030",
  hotline: "800 GULFWAY",
  email:   "enquiry@gwauto.ae",
  website: "gwauto.ae",
  hours:   "Mon - Sat: 8:00 AM - 7:00 PM",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const clean = (v) =>
  v == null || String(v).trim() === "" || String(v).trim().toUpperCase() === "NULL"
    ? "" : String(v).trim();

const fmt  = (n) => n == null || n === "" ? "-" : Number(n).toLocaleString("en-US");
const dStr = () => new Date().toISOString().slice(0, 10);
const sFil = (s) => String(s).replace(/[^a-z0-9]/gi, "_").slice(0, 28);

function normalizeRow(row) {
  return {
    tokenNo:  clean(row.id             || row.token    || ""),
    customer: clean(row.custom_field_1 || row.customer || ""),
    vehicle:  clean(row.custom_field_2 || row.vehicle  || ""),
    crew:     clean(row.custom_field_3 || row.crew     || ""),
    reading:  clean(row.custom_field_4 || row.reading  || ""),
  };
}

function makeXLSX(filename, sheets) {
  const XLSX = window.XLSX;
  if (!XLSX) { alert("Excel library loading. Please try again in a moment."); return; }
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    if (!data?.length) return;
    const ws = Array.isArray(data[0])
      ? XLSX.utils.aoa_to_sheet(data)
      : XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

// ── Mileage buckets ───────────────────────────────────────────────────────────
const BUCKETS = [
  { key:"0-25k",   label:"0 - 25,000 km",      min:0,      max:25000,    color:"#1E8449" },
  { key:"25-50k",  label:"25,000 - 50,000 km",  min:25000,  max:50000,    color:"#2E86C1" },
  { key:"50-75k",  label:"50,000 - 75,000 km",  min:50000,  max:75000,    color:"#D4A017" },
  { key:"75-100k", label:"75,000 - 100,000 km", min:75000,  max:100000,   color:"#CA6F1E" },
  { key:"100k+",   label:"Above 100,000 km",     min:100000, max:Infinity, color:"#C8102E" },
];
const bucketFor = (km) => BUCKETS.find((b) => km >= b.min && km < b.max) || BUCKETS[0];

// ── Vehicle index ─────────────────────────────────────────────────────────────
function buildVIndex(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.vehicle) return;
    const km = parseFloat(r.reading) || 0;
    if (!map.has(r.vehicle)) {
      map.set(r.vehicle, { vehicle:r.vehicle, maxKm:km, latest:r, visits:1,
        customers: new Set(r.customer ? [r.customer] : []),
        crews:     new Set(r.crew     ? [r.crew]     : []),
        history:   [r] });
    } else {
      const v = map.get(r.vehicle);
      v.visits++;
      if (r.customer) v.customers.add(r.customer);
      if (r.crew)     v.crews.add(r.crew);
      v.history.push(r);
      if (km > v.maxKm) { v.maxKm = km; v.latest = r; }
    }
  });
  return Array.from(map.values()).map((v) => ({
    ...v, customers:[...v.customers], crews:[...v.crews],
  }));
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function computeKpis(rows) {
  const valid = rows.filter((r) => r.customer || r.vehicle || r.crew || r.reading);
  const total = valid.length;
  const custs = valid.map((r) => r.customer).filter(Boolean);
  const crews = valid.map((r) => r.crew).filter(Boolean);

  const crewMap = {}; crews.forEach((c) => (crewMap[c] = (crewMap[c]||0)+1));
  const crewSorted = Object.entries(crewMap).sort((a,b)=>b[1]-a[1]);
  const topCrew = crewSorted[0] || ["--",0];

  const custMap = {}; custs.forEach((c) => (custMap[c] = (custMap[c]||0)+1));
  const custSorted = Object.entries(custMap).sort((a,b)=>b[1]-a[1]);
  const topCust = custSorted[0] || ["--",0];

  const kms = valid.map((r) => parseFloat(r.reading)).filter((n) => !isNaN(n) && n > 0);
  const avgKm      = kms.length ? Math.round(kms.reduce((a,b)=>a+b,0)/kms.length) : 0;
  const maxKm      = kms.length ? Math.max(...kms) : 0;
  const completion = total ? Math.round((kms.length/total)*1000)/10 : 0;
  const repeatRate = new Set(custs).size
    ? Math.round((Object.values(custMap).filter((c)=>c>1).length/new Set(custs).size)*1000)/10 : 0;

  const vIndex  = buildVIndex(valid);
  const buckets = BUCKETS.map((b) => ({
    ...b, vehicles: vIndex.filter((v) => v.maxKm >= b.min && v.maxKm < b.max),
  }));

  const nums = valid.map((r)=>parseInt(r.tokenNo)).filter((n)=>!isNaN(n)).sort((a,b)=>a-b);
  const timeline = [];
  if (nums.length) {
    const mn=nums[0], mx=nums[nums.length-1], span=(mx-mn)||1;
    for (let i=0; i<12; i++) {
      const lo=mn+(span/12)*i, hi=mn+(span/12)*(i+1);
      timeline.push({ period:"P"+(i+1), range:Math.round(lo)+"-"+Math.round(hi),
        jobs: nums.filter((t)=>t>=lo&&(i===11?t<=hi:t<hi)).length });
    }
  }

  return { total, uCusts:new Set(custs).size, uVehs:new Set(valid.map((r)=>r.vehicle).filter(Boolean)).size,
           uCrew:new Set(crews).size, topCrew, topCust, avgKm, maxKm,
           completion, repeatRate, crewSorted, custSorted, kms, buckets,
           timeline, valid, vIndex };
}

// ── PDF letterhead ────────────────────────────────────────────────────────────
function openPDF(vehicle, history) {
  const win = window.open("","_blank","width=920,height=1100");
  if (!win) { alert("Allow pop-ups to open PDF report."); return; }
  const today   = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const sorted  = [...history].sort((a,b)=>parseInt(a.tokenNo)-parseInt(b.tokenNo));
  const custs   = [...new Set(history.map((h)=>h.customer).filter(Boolean))];
  const crews   = [...new Set(history.map((h)=>h.crew).filter(Boolean))];
  const kms     = history.map((h)=>parseFloat(h.reading)).filter((n)=>!isNaN(n)&&n>0);
  const minKm   = kms.length ? Math.min(...kms) : null;
  const maxKm   = kms.length ? Math.max(...kms) : null;
  const dist    = minKm!==null&&maxKm!==null&&maxKm>minKm ? maxKm-minKm : null;
  const rows    = sorted.map((h,i)=>`
    <tr>
      <td>${i+1}</td>
      <td class="mo"><b style="color:#C8102E">#${h.tokenNo||"-"}</b></td>
      <td>${h.customer||"<i style='color:#aaa'>Not recorded</i>"}</td>
      <td>${h.crew?`<span class="tag">${h.crew}</span>`:"-"}</td>
      <td class="r mo"><b>${h.reading?fmt(parseInt(h.reading)):"-"}</b></td>
    </tr>`).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Service History - ${vehicle}</title>
<style>
  @page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;background:#fff}
  .page{width:210mm;min-height:297mm;padding:16mm 14mm;position:relative}
  /* Letterhead */
  .lh{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:4px solid #C8102E;position:relative}
  .lh::after{content:'';position:absolute;left:0;right:0;bottom:-10px;height:2px;background:#0A0A0A}
  .mark{width:60px;height:60px;background:#C8102E;color:#fff;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:900;font-size:26px;box-shadow:4px 4px 0 #0A0A0A;flex-shrink:0}
  .brand{display:flex;align-items:center;gap:13px}
  .bname{font-family:Georgia,serif;font-size:19px;font-weight:900;color:#0A0A0A;line-height:1.1}
  .btag{font-size:8.5px;letter-spacing:3px;color:#C8102E;text-transform:uppercase;margin-top:4px;font-weight:700}
  .contact{text-align:right;font-size:9.5px;color:#555;line-height:1.7}
  .contact b{color:#0A0A0A}
  /* Doc title */
  .dtitle{margin-top:26px;padding:13px 16px;background:#0A0A0A;color:#fff;display:flex;justify-content:space-between;align-items:center}
  .dtitle h1{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .dno{font-size:9px;color:#C8102E;letter-spacing:1px}
  /* Vehicle banner */
  .vb{margin-top:15px;padding:16px 18px;background:linear-gradient(90deg,#f9f4f4,#fff);border:1px solid #e0e0e0;border-left:6px solid #C8102E;display:flex;justify-content:space-between;align-items:center}
  .vlab{font-size:8.5px;letter-spacing:2px;color:#888;text-transform:uppercase}
  .vnum{font-family:'Courier New',monospace;font-size:28px;font-weight:900;color:#0A0A0A;letter-spacing:2px;margin-top:2px}
  .vstats{display:flex;gap:28px}
  .sv{font-family:'Courier New',monospace;font-size:20px;font-weight:900;color:#C8102E}
  /* Info grid */
  .ig{margin-top:13px;display:grid;grid-template-columns:1fr 1fr;border:1px solid #e0e0e0}
  .ic{padding:10px 13px;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0}
  .ic:nth-child(2n){border-right:none}.ic:nth-last-child(-n+2){border-bottom:none}
  .il{font-size:8px;letter-spacing:1.5px;color:#888;text-transform:uppercase;margin-bottom:3px}
  .iv{font-size:11px;color:#0A0A0A;font-weight:600}
  /* Table */
  .sh{margin-top:20px;padding-bottom:5px;border-bottom:2px solid #C8102E;font-size:10px;letter-spacing:2px;color:#0A0A0A;text-transform:uppercase;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
  thead th{background:#0A0A0A;color:#fff;text-align:left;padding:8px 9px;font-size:8.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
  thead th.r{text-align:right}
  tbody td{padding:7px 9px;border-bottom:1px solid #eee}
  tbody td.mo{font-family:'Courier New',monospace}
  tbody td.r{text-align:right}
  tbody tr:nth-child(even) td{background:#fafafa}
  .tag{display:inline-block;padding:1px 6px;background:#ffeaec;color:#9A0E26;font-family:'Courier New',monospace;font-size:10px;font-weight:700}
  /* Gold accent bar */
  .gbar{height:3px;background:linear-gradient(90deg,#C8102E,#D4A017);margin-top:11px}
  .note{margin-top:11px;padding:9px 11px;background:#fffbf0;border-left:3px solid #D4A017;font-size:9px;color:#7a5c00;line-height:1.6}
  .foot{margin-top:18px;border-top:2px solid #C8102E;padding-top:8px;display:flex;justify-content:space-between;font-size:8.5px;color:#888}
  /* Print bar */
  .bar{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:99}
  .bar button{padding:9px 16px;border:none;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .bp{background:#C8102E;color:#fff}.bc{background:#0A0A0A;color:#fff}
  @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="bar">
  <button class="bp" onclick="window.print()">Save as PDF</button>
  <button class="bc" onclick="window.close()">Close</button>
</div>
<div class="page">
  <div class="lh">
    <div class="brand">
      <div class="mark">GW</div>
      <div>
        <div class="bname">${CO.name}</div>
        <div class="btag">Trusted Vehicle &amp; Bike Repair Services</div>
      </div>
    </div>
    <div class="contact">
      <b>${CO.address}</b><br>
      Tel: <b>${CO.phone}</b> &nbsp;|&nbsp; Hotline: <b>${CO.hotline}</b><br>
      ${CO.email} &nbsp;|&nbsp; ${CO.website}<br>
      <span style="color:#C8102E">${CO.hours}</span>
    </div>
  </div>
  <div class="dtitle">
    <h1>Vehicle Service History Report</h1>
    <div class="dno">REF: GWAS-VHR-${vehicle} &nbsp;&nbsp; ${today}</div>
  </div>
  <div class="vb">
    <div>
      <div class="vlab">Vehicle / Bike Number</div>
      <div class="vnum">${vehicle}</div>
    </div>
    <div class="vstats">
      <div><div class="vlab">Total Visits</div><div class="sv">${history.length}</div></div>
      <div><div class="vlab">Last Reading</div><div class="sv">${maxKm?fmt(maxKm):"-"} <span style="font-size:10px;color:#888">km</span></div></div>
      ${dist!==null?`<div><div class="vlab">Distance Covered</div><div class="sv">${fmt(dist)} <span style="font-size:10px;color:#888">km</span></div></div>`:""}
    </div>
  </div>
  <div class="ig">
    <div class="ic"><div class="il">Registered Customer(s)</div><div class="iv">${custs.join(", ")||"Not recorded"}</div></div>
    <div class="ic"><div class="il">Servicing Crew</div><div class="iv">${crews.join(", ")||"Not recorded"}</div></div>
    <div class="ic"><div class="il">First Service Token</div><div class="iv">#${sorted[0]?.tokenNo||"-"}</div></div>
    <div class="ic"><div class="il">Latest Service Token</div><div class="iv">#${sorted[sorted.length-1]?.tokenNo||"-"}</div></div>
  </div>
  <div class="gbar"></div>
  <div class="sh">Service Log</div>
  <table>
    <thead><tr><th style="width:32px">#</th><th>Token No</th><th>Customer Name</th><th>Crew Code</th><th class="r">Odometer (km)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="note">
    <b>Disclaimer:</b> This report is generated from internal service records of ${CO.name}. Odometer readings are as recorded at the time of each service visit. For queries contact ${CO.phone} or ${CO.email}.
  </div>
  <div class="foot">
    <span>${CO.name} &nbsp;|&nbsp; ${CO.website}</span>
    <span>Generated ${today} &nbsp;|&nbsp; Page 1 of 1</span>
  </div>
</div></body></html>`);
  win.document.close();
}

// ── TOOLTIP (dark themed) ─────────────────────────────────────────────────────
const DarkTooltip = {
  contentStyle: {
    background: "#1A1A1A",
    border: `1px solid #C8102E`,
    borderRadius: 4,
    color: "#F0F0F0",
    fontSize: 12,
    boxShadow: "0 4px 20px rgba(200,16,46,0.25)",
  },
  labelStyle: { color: "#D4A017", fontWeight: 700 },
  itemStyle:  { color: "#F0F0F0" },
  cursor:     { fill: "rgba(200,16,46,0.08)" },
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [rows,       setRows]       = useState([]);
  const [fileName,   setFileName]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [parseErr,   setParseErr]   = useState("");
  const [search,     setSearch]     = useState("");
  const [crewFilter, setCrewFilter] = useState("ALL");
  const [page,       setPage]       = useState(1);
  const [drag,       setDrag]       = useState(false);
  const [modal,      setModal]      = useState(null);
  const PAGE    = 15;
  const fileRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setLoading(true); setParseErr(""); setFileName(file.name);
    const parse = (d) => new Promise((res,rej) =>
      Papa.parse(file,{ header:true, delimiter:d, skipEmptyLines:true,
        transformHeader:(h)=>h.trim().toLowerCase(), complete:res, error:rej }));
    parse(";")
      .then((r) => r.data.length && Object.keys(r.data[0]).length>=2
        ? r.data : parse(",").then((r2)=>r2.data))
      .then((data) => { setRows(data.map(normalizeRow)); setPage(1); setLoading(false); })
      .catch((e)   => { setParseErr(e.message||"Parse failed"); setLoading(false); });
  }, []);

  const kpis     = useMemo(() => computeKpis(rows), [rows]);
  const crewOpts = useMemo(() => ["ALL",...[...new Set(rows.map((r)=>r.crew).filter(Boolean))].sort()],[rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (crewFilter!=="ALL" && r.crew!==crewFilter) return false;
      if (!q) return true;
      return [r.tokenNo,r.customer,r.vehicle,r.crew,r.reading].some((v)=>v.toLowerCase().includes(q));
    });
  },[rows,search,crewFilter]);

  const pageCount = Math.max(1,Math.ceil(filtered.length/PAGE));
  const paged     = filtered.slice((page-1)*PAGE, page*PAGE);
  const hasData   = rows.length > 0;
  const reset     = () => { setRows([]); setFileName(""); setSearch(""); setCrewFilter("ALL"); setPage(1); setModal(null); };

  // ── Exports ─────────────────────────────────────────────────────────────────
  const toRow = (r) => ({"Token No":r.tokenNo, Customer:r.customer, "Vehicle/Bike":r.vehicle, Crew:r.crew, "Reading km":r.reading?parseInt(r.reading):""});
  const xAll   = () => makeXLSX(`GW_Records_${dStr()}.xlsx`,     [{name:"Service Records", data:kpis.valid.map(toRow)}]);
  const xCust  = () => makeXLSX(`GW_Customers_${dStr()}.xlsx`,   [{name:"Customers", data:kpis.custSorted.map(([n,c],i)=>({Rank:i+1,Customer:n,Visits:c,Status:c>1?"Repeat":"First-time"}))}]);
  const xVehs  = () => makeXLSX(`GW_Vehicles_${dStr()}.xlsx`,    [{name:"Vehicles",  data:kpis.vIndex.slice().sort((a,b)=>b.maxKm-a.maxKm).map((v,i)=>({Rank:i+1,"Vehicle/Bike":v.vehicle,Visits:v.visits,"Latest km":v.maxKm||"",Bucket:bucketFor(v.maxKm).label,Customers:v.customers.join(", "),Crews:v.crews.join(", ")}))}]);
  const xCrew  = () => makeXLSX(`GW_Crew_${dStr()}.xlsx`,        [{name:"Crew", data:kpis.crewSorted.map(([n,c],i)=>({Rank:i+1,"Crew Code":n,Jobs:c,"Share %":Math.round(c/kpis.total*10000)/100}))}]);
  const xTCrew = () => { const c=kpis.topCrew[0]; makeXLSX(`GW_TopCrew_${sFil(c)}_${dStr()}.xlsx`,[{name:c.slice(0,31),data:kpis.valid.filter((r)=>r.crew===c).map(toRow)}]); };
  const xTCust = () => { const n=kpis.topCust[0]; makeXLSX(`GW_VIP_${sFil(n)}_${dStr()}.xlsx`,   [{name:"VIP Visits",data:kpis.valid.filter((r)=>r.customer===n).map(toRow)}]); };
  const xRead  = () => makeXLSX(`GW_Readings_${dStr()}.xlsx`,
    [{name:"Stats",data:[["Metric","Value"],["With reading",kpis.kms.length],["Avg km",kpis.avgKm],["Max km",kpis.maxKm],["Min km",kpis.kms.length?Math.min(...kpis.kms):0]]},
     {name:"All readings",data:kpis.valid.filter((r)=>r.reading&&!isNaN(parseFloat(r.reading))).map(toRow)}]);
  const xQual  = () => {
    const w=kpis.valid.filter((r)=>r.reading&&!isNaN(parseFloat(r.reading)));
    const wo=kpis.valid.filter((r)=>!r.reading||isNaN(parseFloat(r.reading)));
    makeXLSX(`GW_Quality_${dStr()}.xlsx`,[
      {name:"Summary",data:[["Total",kpis.total],["With reading",w.length],["Without",wo.length],["Completion %",kpis.completion]]},
      {name:"With reading",data:w.map(toRow)},{name:"Missing reading",data:wo.map(toRow)}]);
  };
  const xBucket  = (bk) => makeXLSX(`GW_${bk.key}_${dStr()}.xlsx`,
    [{name:bk.key,data:[...bk.vehicles].sort((a,b)=>b.maxKm-a.maxKm).map((v,i)=>
      ({"S.No":i+1,"Vehicle/Bike":v.vehicle,"Latest km":v.maxKm,Visits:v.visits,Customers:v.customers.join(", "),Crews:v.crews.join(", "),"Last Token":v.latest.tokenNo}))}]);
  const xVehicle = (veh) => {
    const h=[...rows.filter((r)=>r.vehicle===veh)].sort((a,b)=>parseInt(a.tokenNo)-parseInt(b.tokenNo));
    const kv=h.map((x)=>parseFloat(x.reading)).filter((n)=>!isNaN(n)&&n>0);
    makeXLSX(`GW_Vehicle_${sFil(veh)}_${dStr()}.xlsx`,[
      {name:"Summary",data:[["Vehicle/Bike",veh],["Total visits",h.length],["First token",h[0]?.tokenNo||""],["Latest token",h[h.length-1]?.tokenNo||""],["Latest km",kv.length?Math.max(...kv):""],["Distance km",kv.length>1?Math.max(...kv)-Math.min(...kv):""],["Customer(s)",[...new Set(h.map((x)=>x.customer).filter(Boolean))].join(", ")],["Crew(s)",[...new Set(h.map((x)=>x.crew).filter(Boolean))].join(", ")]]},
      {name:"Service log",data:h.map((x,i)=>({"S.No":i+1,Token:x.tokenNo,Customer:x.customer,Crew:x.crew,"km":x.reading?parseInt(x.reading):""}))}]);
  };
  const xMaster = () => {
    const sh=[
      {name:"Service Records", data:kpis.valid.map(toRow)},
      {name:"KPI Summary",     data:[["Metric","Value"],["Total tokens",kpis.total],["Unique customers",kpis.uCusts],["Unique vehicles",kpis.uVehs],["Active crew",kpis.uCrew],["Top crew",kpis.topCrew[0]+" ("+kpis.topCrew[1]+" jobs)"],["VIP customer",kpis.topCust[0]+" ("+kpis.topCust[1]+" visits)"],["Avg km",kpis.avgKm],["Max km",kpis.maxKm],["Completion %",kpis.completion],["Repeat rate %",kpis.repeatRate]]},
      {name:"Crew Leaderboard",    data:kpis.crewSorted.map(([n,c],i)=>({Rank:i+1,"Crew Code":n,Jobs:c}))},
      {name:"Customer Leaderboard",data:kpis.custSorted.map(([n,c],i)=>({Rank:i+1,Customer:n,Visits:c}))},
      {name:"Vehicle Master",      data:kpis.vIndex.slice().sort((a,b)=>b.maxKm-a.maxKm).map((v,i)=>({Rank:i+1,Vehicle:v.vehicle,"Latest km":v.maxKm,Visits:v.visits,Bucket:bucketFor(v.maxKm).label}))},
    ];
    kpis.buckets.forEach((bk)=>sh.push({name:"Mileage "+bk.key,
      data:[...bk.vehicles].sort((a,b)=>b.maxKm-a.maxKm).map((v,i)=>
        ({"S.No":i+1,Vehicle:v.vehicle,"Latest km":v.maxKm,Visits:v.visits,Customers:v.customers.join(", "),Crews:v.crews.join(", ")}))}));
    makeXLSX(`GW_MasterReport_${dStr()}.xlsx`,sh);
  };

  // ── Global CSS ───────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
    *{box-sizing:border-box}
    body{margin:0;background:${T.bg};font-family:'Inter',sans-serif;color:${T.text}}
    .fd{font-family:'Playfair Display',serif}
    .fm{font-family:'JetBrains Mono',monospace;font-feature-settings:'tnum'}

    /* Glow shadow for cards */
    .gw-card{
      background:${T.surface};
      border:1px solid ${T.border};
      border-top:3px solid ${T.red};
      box-shadow:0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,16,46,0.06);
      transition:box-shadow .2s;
    }
    .gw-card:hover{box-shadow:0 4px 24px rgba(0,0,0,0.6),0 0 0 1px rgba(200,16,46,0.15);}

    .gw-card-gold{
      background:${T.surface};
      border:1px solid ${T.border};
      border-top:3px solid ${T.gold};
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    }

    /* Red gradient stripe */
    .stripe{
      background:linear-gradient(90deg,${T.red} 0%,${T.redDark} 40%,#1A1A1A 100%);
    }

    /* Download pill */
    .pill{
      display:inline-flex;align-items:center;gap:3px;
      padding:2px 8px;
      background:rgba(200,16,46,0.12);
      color:${T.red};
      border:1px solid rgba(200,16,46,0.3);
      cursor:pointer;font-size:10px;font-weight:700;border-radius:3px;
      transition:all .15s;
    }
    .pill:hover{background:${T.red};color:#fff;border-color:${T.red};}

    /* Vehicle link */
    .vlink{
      color:${T.red};background:none;border:none;
      border-bottom:1px dashed rgba(200,16,46,0.4);
      cursor:pointer;font-family:'JetBrains Mono',monospace;
      font-weight:700;font-size:inherit;padding:0;transition:all .15s;
    }
    .vlink:hover{color:${T.goldLight};border-bottom-color:${T.gold};}

    /* Icon button */
    .ibtn{
      width:28px;height:28px;display:inline-flex;align-items:center;
      justify-content:center;border:none;cursor:pointer;transition:transform .15s,opacity .15s;
      border-radius:3px;
    }
    .ibtn:hover{transform:scale(1.12);opacity:.9}

    /* Scrollbar */
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:${T.bg}}
    ::-webkit-scrollbar-thumb{background:${T.borderHi};border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:${T.red}}

    /* Input/select */
    input,select{
      background:${T.surfaceBd};border:1px solid ${T.border};
      color:${T.text};font-family:'Inter',sans-serif;
    }
    input::placeholder{color:${T.textDim}}
    input:focus,select:focus{outline:2px solid ${T.red};outline-offset:1px;border-color:${T.red}}

    /* recharts legend text */
    .recharts-legend-item-text{color:${T.textSub} !important;font-size:11px}
  `;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text}}>
      <style>{css}</style>

      {/* ── HEADER ── */}
      <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:30,boxShadow:"0 2px 20px rgba(0,0,0,0.5)"}}>
        <div className="stripe" style={{height:5}}/>
        <div style={{maxWidth:1600,margin:"0 auto",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* Logo area */}
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div className="fd" style={{width:52,height:52,background:T.red,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,boxShadow:`4px 4px 0 ${T.gold}`,flexShrink:0}}>GW</div>
            <div>
              <div className="fd" style={{fontSize:20,fontWeight:900,color:T.text,lineHeight:1}}>{CO.name}</div>
              <div style={{fontSize:10,letterSpacing:"0.28em",color:T.gold,fontWeight:700,textTransform:"uppercase",marginTop:5}}>Service Analytics &amp; Fleet Intelligence</div>
            </div>
          </div>
          {/* Header actions */}
          {hasData && (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className="fm" style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(30,132,73,0.15)",border:"1px solid rgba(30,132,73,0.4)",color:"#2ECC71",fontSize:11,borderRadius:3}}>
                <CheckCircle2 size={13}/> {fileName}
              </div>
              <button onClick={xMaster} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 18px",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,borderRadius:3,boxShadow:"0 2px 12px rgba(200,16,46,0.4)"}}>
                <FileSpreadsheet size={14}/> Master Report
              </button>
              <button onClick={reset} style={{padding:8,background:"none",border:`1px solid ${T.border}`,cursor:"pointer",color:T.textSub,borderRadius:3}}>
                <RefreshCw size={15}/>
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{maxWidth:1600,margin:"0 auto",padding:"36px 24px"}}>

        {/* ── UPLOAD ── */}
        {!hasData && (
          <div
            onClick={()=>fileRef.current?.click()}
            onDragEnter={(e)=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDragOver={(e)=>e.preventDefault()}
            onDrop={(e)=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            style={{
              background:drag?T.surfaceHi:T.surface,
              border:`2px ${drag?"solid":"dashed"} ${drag?T.red:T.borderHi}`,
              borderTop:`4px solid ${T.red}`,
              padding:"90px 40px",cursor:"pointer",textAlign:"center",
              boxShadow:drag?"0 0 40px rgba(200,16,46,0.2)":"none",
              transition:"all .2s",
            }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={(e)=>handleFile(e.target.files[0])}/>
            <div style={{width:88,height:88,background:T.red,boxShadow:`6px 6px 0 ${T.gold},0 0 40px rgba(200,16,46,0.3)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 28px"}}>
              <Upload size={40} color="#fff"/>
            </div>
            <div className="fd" style={{fontSize:36,fontWeight:900,color:T.text,marginBottom:14}}>Upload Your Service Log</div>
            <p style={{color:T.textSub,maxWidth:520,margin:"0 auto 28px",lineHeight:1.7}}>
              Drop your garage CSV — all KPIs, crew analytics, mileage fleet registry, XLSX exports &amp; branded PDF reports generated instantly.
            </p>
            <div className="fm" style={{display:"inline-flex",alignItems:"center",gap:14,padding:"10px 22px",background:T.surfaceBd,border:`1px solid ${T.border}`,fontSize:12,borderRadius:3}}>
              <span style={{color:T.red,fontWeight:700}}>.CSV</span>
              <span style={{color:T.textDim}}>|</span>
              <span style={{color:T.textSub}}>Auto-detects ; or ,</span>
              <span style={{color:T.textDim}}>|</span>
              <span style={{color:T.textSub}}>Up to 50,000 rows</span>
            </div>
            {loading && <div className="fm" style={{marginTop:22,color:T.red,fontWeight:700,letterSpacing:"0.2em"}}>PARSING...</div>}
            {parseErr && <div className="fm" style={{marginTop:22,color:T.red}}>{parseErr}</div>}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {hasData && (<>

          {/* ─ 01 KPIs ─ */}
          <ST eyebrow="01  Performance Indicators" title="At-a-Glance KPIs" sub="Every metric has a direct XLSX export. Click the red pill on any card to download the underlying dataset."/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:14}}>
            <KV icon={<Wrench size={18}/>}    label="Service Tokens"    value={fmt(kpis.total)}       sub="Total jobs logged"              accent onExport={xAll}   tag="Records"   />
            <KV icon={<Users size={18}/>}     label="Unique Customers"  value={fmt(kpis.uCusts)}      sub={kpis.repeatRate+"% repeat rate"}       onExport={xCust}  tag="Customers" />
            <KV icon={<Car size={18}/>}       label="Vehicles Serviced" value={fmt(kpis.uVehs)}       sub="Distinct units"                        onExport={xVehs}  tag="Fleet"     />
            <KV icon={<HardHat size={18}/>}   label="Active Crew"       value={fmt(kpis.uCrew)}       sub={"Top: "+kpis.topCrew[0]}               onExport={xCrew}  tag="Crew"      />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:56}}>
            <KV icon={<Award size={18}/>}     label="Top Crew Output"   value={fmt(kpis.topCrew[1])}  sub={kpis.topCrew[0]+" — jobs"}             onExport={xTCrew} tag="Top Crew"  />
            <KV icon={<TrendingUp size={18}/>}label="VIP Customer"      value={fmt(kpis.topCust[1])}  sub={kpis.topCust[0]+" — visits"}           onExport={xTCust} tag="VIP"       />
            <KV icon={<Gauge size={18}/>}     label="Avg Reading"       value={fmt(kpis.avgKm)+" km"} sub="Average odometer across logs"          onExport={xRead}  tag="Readings"  />
            <KV icon={<Activity size={18}/>}  label="Data Quality"      value={kpis.completion+"%"}   sub="Reading completion rate"               onExport={xQual}  tag="Quality"   />
          </div>

          {/* ─ 02 Mileage Fleet Registry ─ */}
          <ST eyebrow="02  Mileage Fleet Registry" title="Vehicles by Kilometers Driven" sub="Each unique vehicle appears in exactly one bucket based on its latest odometer reading. Zero duplicates. Download any bucket as XLSX."/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:56}}>
            {kpis.buckets.map((bk)=>(
              <BC key={bk.key} bk={bk}
                onExport={()=>xBucket(bk)}
                onPick={(v)=>setModal({vehicle:v,history:rows.filter((r)=>r.vehicle===v)})}/>
            ))}
          </div>

          {/* ─ 03 Charts ─ */}
          <ST eyebrow="03  Visual Analytics" title="Crew Performance &amp; Workload" sub="Interactive charts with professional Gulf Way color palette."/>

          {/* Row 1: Crew bar + Donut */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
            <div className="gw-card" style={{padding:22}}>
              <ChHdr title="Crew Leaderboard" sub="Top 10 crew members by total jobs handled" onExport={xCrew}/>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={kpis.crewSorted.slice(0,10).map(([n,c],i)=>({name:n,jobs:c,fill:GRAPH_PALETTE[i%8]}))} margin={{top:6,right:8,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.red} stopOpacity={1}/>
                      <stop offset="100%" stopColor={T.redDark} stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.border} strokeDasharray="4 4" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:T.textSub,fontSize:11}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.textSub,fontSize:11}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <Tooltip {...DarkTooltip}/>
                  <Bar dataKey="jobs" fill="url(#barGrad)" radius={[4,4,0,0]}>
                    {kpis.crewSorted.slice(0,10).map(([,],i)=>(
                      <Cell key={i} fill={GRAPH_PALETTE[i%8]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="gw-card" style={{padding:22}}>
              <ChHdr title="Workload Share" sub="Crew distribution by job volume"/>
              <ResponsiveContainer width="100%" height={290}>
                <PieChart>
                  <defs>
                    {GRAPH_PALETTE.map((c,i)=>(
                      <radialGradient key={i} id={`pg${i}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={c} stopOpacity={1}/>
                        <stop offset="100%" stopColor={c} stopOpacity={0.7}/>
                      </radialGradient>
                    ))}
                  </defs>
                  <Pie
                    data={[...kpis.crewSorted.slice(0,7).map(([n,c])=>({name:n,value:c})),
                           ...(kpis.crewSorted.length>7?[{name:"Others",value:kpis.crewSorted.slice(7).reduce((s,[,c])=>s+c,0)}]:[])]}
                    dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={58} outerRadius={96} paddingAngle={3}
                    strokeWidth={0}>
                    {GRAPH_PALETTE.map((c,i)=><Cell key={i} fill={`url(#pg${i})`}/>)}
                  </Pie>
                  <Tooltip {...DarkTooltip}/>
                  <Legend wrapperStyle={{fontSize:11,color:T.textSub}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Area + Bucket bar */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:56}}>
            <div className="gw-card" style={{padding:22}}>
              <ChHdr title="Job Volume Timeline" sub="Service activity across 12 chronological periods"/>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={kpis.timeline} margin={{top:6,right:8,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={T.red}  stopOpacity={0.5}/>
                      <stop offset="100%" stopColor={T.red}  stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={T.gold} stopOpacity={0.3}/>
                      <stop offset="100%" stopColor={T.gold} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.border} strokeDasharray="4 4" vertical={false}/>
                  <XAxis dataKey="period" tick={{fill:T.textSub,fontSize:11}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.textSub,fontSize:11}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <Tooltip {...DarkTooltip} labelFormatter={(l,p)=>p?.[0]?"Tokens "+p[0].payload.range:l}/>
                  <Area type="monotone" dataKey="jobs" stroke={T.red} strokeWidth={2.5} fill="url(#areaGrad)" dot={{fill:T.red,r:3,strokeWidth:0}} activeDot={{r:5,fill:T.gold}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="gw-card" style={{padding:22}}>
              <ChHdr title="Mileage Buckets" sub="Unique vehicles per odometer band"/>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={kpis.buckets.map((bk)=>({range:bk.key,count:bk.vehicles.length,color:bk.color}))} margin={{top:6,right:8,left:0,bottom:0}}>
                  <CartesianGrid stroke={T.border} strokeDasharray="4 4" vertical={false}/>
                  <XAxis dataKey="range" tick={{fill:T.textSub,fontSize:10}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.textSub,fontSize:11}} stroke={T.border} axisLine={false} tickLine={false}/>
                  <Tooltip {...DarkTooltip}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {kpis.buckets.map((bk,i)=><Cell key={i} fill={bk.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ─ 04 Service Log ─ */}
          <ST eyebrow="04  Service Register" title="Token-Level Service Log" sub="Click any vehicle number to open its branded PDF. Row icons: green = XLSX history, red = PDF letterhead, navy = quick preview."/>

          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:`3px solid ${T.red}`,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
            {/* Controls bar */}
            <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div className="fd" style={{fontSize:19,fontWeight:900,color:T.text}}>Service Log</div>
                <div style={{fontSize:10,color:T.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.22em",marginTop:3}}>
                  {fmt(filtered.length)} of {fmt(rows.length)} records
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{position:"relative"}}>
                  <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.textDim}}/>
                  <input value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}} placeholder="Search token, customer, vehicle..."
                    style={{paddingLeft:32,paddingRight:10,paddingTop:8,paddingBottom:8,fontSize:12,width:280,borderRadius:3}}/>
                </div>
                <div style={{position:"relative"}}>
                  <Filter size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.textDim}}/>
                  <select value={crewFilter} onChange={(e)=>{setCrewFilter(e.target.value);setPage(1);}}
                    style={{paddingLeft:32,paddingRight:12,paddingTop:8,paddingBottom:8,fontSize:12,appearance:"none",cursor:"pointer",borderRadius:3}}>
                    {crewOpts.map((c)=><option key={c} value={c}>{c==="ALL"?"All Crew":c}</option>)}
                  </select>
                </div>
                {(search||crewFilter!=="ALL")&&(
                  <button onClick={()=>{setSearch("");setCrewFilter("ALL");}} style={{padding:7,background:"none",border:`1px solid ${T.border}`,cursor:"pointer",color:T.textSub,borderRadius:3}}><X size={14}/></button>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"#0D0D0D"}}>
                    {["Token","Customer","Vehicle / Bike No","Crew","Reading (km)","Reports"].map((h,i)=>(
                      <th key={h} style={{padding:"10px 18px",textAlign:i>=4?"right":"left",color:T.textSub,fontSize:9.5,letterSpacing:"0.18em",textTransform:"uppercase",fontWeight:700,borderBottom:`2px solid ${T.red}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r,i)=>(
                    <tr key={i} style={{background:i%2===0?T.surface:T.surfaceBd,borderBottom:`1px solid ${T.border}`,transition:"background .1s"}}
                      onMouseEnter={(e)=>e.currentTarget.style.background=T.surfaceHi}
                      onMouseLeave={(e)=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceBd}>
                      <td className="fm" style={{padding:"10px 18px",color:T.red,fontWeight:700}}>#{r.tokenNo||"-"}</td>
                      <td style={{padding:"10px 18px",color:T.text}}>{r.customer||<span style={{color:T.textDim}}>-</span>}</td>
                      <td style={{padding:"10px 18px"}}>
                        {r.vehicle
                          ? <button className="vlink" onClick={()=>openPDF(r.vehicle,rows.filter((x)=>x.vehicle===r.vehicle))} title={"PDF for "+r.vehicle}>{r.vehicle}</button>
                          : <span style={{color:T.textDim}}>-</span>}
                      </td>
                      <td style={{padding:"10px 18px"}}>
                        {r.crew
                          ? <span className="fm" style={{padding:"2px 8px",background:"rgba(200,16,46,0.15)",color:"#FF6B6B",fontWeight:700,fontSize:11,borderRadius:2,border:"1px solid rgba(200,16,46,0.25)"}}>{r.crew}</span>
                          : <span style={{color:T.textDim}}>-</span>}
                      </td>
                      <td className="fm" style={{padding:"10px 18px",textAlign:"right",fontWeight:700,color:T.text}}>
                        {r.reading?fmt(parseInt(r.reading)):<span style={{color:T.textDim}}>-</span>}
                      </td>
                      <td style={{padding:"10px 18px",textAlign:"right"}}>
                        {r.vehicle&&(
                          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5}}>
                            <button className="ibtn" onClick={()=>xVehicle(r.vehicle)}  title="XLSX history"    style={{background:"rgba(30,132,73,0.7)",  color:"#fff"}}><FileSpreadsheet size={12}/></button>
                            <button className="ibtn" onClick={()=>openPDF(r.vehicle,rows.filter((x)=>x.vehicle===r.vehicle))} title="PDF letterhead" style={{background:T.red,color:"#fff"}}><FileText size={12}/></button>
                            <button className="ibtn" onClick={()=>setModal({vehicle:r.vehicle,history:rows.filter((x)=>x.vehicle===r.vehicle)})} title="Quick preview" style={{background:"rgba(46,134,193,0.7)",color:"#fff"}}><Eye size={12}/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paged.length===0&&(
                    <tr><td colSpan={6} style={{padding:"50px 18px",textAlign:"center",color:T.textDim}}>No matching records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{padding:"13px 22px",borderTop:`1px solid ${T.border}`,background:T.surfaceBd,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div className="fm" style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.15em"}}>Page {page} of {pageCount}</div>
              <div style={{display:"flex",gap:7}}>
                <PB disabled={page===1}        onClick={()=>setPage((p)=>Math.max(1,p-1))}><ChevronLeft size={14}/></PB>
                <PB disabled={page===pageCount} onClick={()=>setPage((p)=>Math.min(pageCount,p+1))}><ChevronRight size={14}/></PB>
              </div>
            </div>
          </div>

          {/* Master export CTA */}
          <div style={{marginTop:56,padding:"32px 36px",background:`linear-gradient(135deg,${T.surfaceHi},${T.surface})`,border:`1px solid ${T.border}`,borderTop:`4px solid ${T.red}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:18,boxShadow:"0 4px 32px rgba(200,16,46,0.15)"}}>
            <div>
              <div className="fd" style={{fontSize:24,fontWeight:900,color:T.text}}>Master Report Package</div>
              <p style={{fontSize:13,color:T.textSub,marginTop:7,lineHeight:1.6}}>
                Multi-sheet Excel: service records, KPI summary, crew leaderboard, customer master, vehicle master + 5 mileage bucket sheets.
              </p>
            </div>
            <button onClick={xMaster} style={{display:"flex",alignItems:"center",gap:8,padding:"13px 26px",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontWeight:700,fontSize:14,borderRadius:3,boxShadow:"0 4px 20px rgba(200,16,46,0.4)"}}>
              <Download size={16}/> Download Master .xlsx
            </button>
          </div>

        </>)}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{background:T.surface,borderTop:`1px solid ${T.border}`,marginTop:72}}>
        <div style={{maxWidth:1600,margin:"0 auto",padding:"32px 24px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:24}}>
          <div>
            <div className="fd" style={{fontSize:17,fontWeight:900,color:T.text}}>{CO.name}</div>
            <p style={{fontSize:12,color:T.textSub,marginTop:8,lineHeight:1.7}}>Trusted vehicle &amp; bike repair services across UAE.</p>
            <div style={{marginTop:12,height:2,width:40,background:`linear-gradient(90deg,${T.red},${T.gold})`}}/>
          </div>
          <FC icon={<MapPin size={13}/>}  label="Location">{CO.address}</FC>
          <FC icon={<Phone size={13}/>}   label="Contact">{CO.phone}<br/>{CO.hotline}</FC>
          <FC icon={<Mail size={13}/>}    label="Online">{CO.email}<br/><span style={{color:T.red}}>{CO.website}</span></FC>
        </div>
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div className="fm" style={{fontSize:10,color:T.textDim}}>Gulf Way Auto Service LLC &copy; {new Date().getFullYear()}</div>
          <div className="fm" style={{fontSize:10,color:T.textDim}}>{CO.website}</div>
        </div>
      </footer>

      {/* ── VEHICLE HISTORY MODAL ── */}
      {modal&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:40,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}>
          <div onClick={(e)=>e.stopPropagation()} style={{width:"100%",maxWidth:780,maxHeight:"87vh",display:"flex",flexDirection:"column",background:T.surface,border:`1px solid ${T.border}`,borderTop:`4px solid ${T.red}`,boxShadow:"0 8px 60px rgba(200,16,46,0.2)"}}>
            <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:10,color:T.gold,fontWeight:700,letterSpacing:"0.25em",textTransform:"uppercase"}}>Vehicle History</div>
                <div className="fd fm" style={{fontSize:24,fontWeight:900,color:T.text,marginTop:3}}>{modal.vehicle}</div>
                <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{modal.history.length} service visits</div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"none",border:`1px solid ${T.border}`,cursor:"pointer",color:T.textSub,padding:6,borderRadius:3}}><X size={18}/></button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"#0D0D0D"}}>
                    {["#","Token","Customer","Crew","km"].map((h,i)=>(
                      <th key={h} style={{padding:"9px 16px",textAlign:i===4?"right":"left",color:T.textSub,fontSize:9.5,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:700,borderBottom:`2px solid ${T.red}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...modal.history].sort((a,b)=>parseInt(a.tokenNo)-parseInt(b.tokenNo)).map((h,i)=>(
                    <tr key={i} style={{background:i%2===0?T.surface:T.surfaceBd,borderBottom:`1px solid ${T.border}`}}>
                      <td className="fm" style={{padding:"9px 16px",color:T.textDim}}>{i+1}</td>
                      <td className="fm" style={{padding:"9px 16px",color:T.red,fontWeight:700}}>#{h.tokenNo}</td>
                      <td style={{padding:"9px 16px",color:T.text}}>{h.customer||"-"}</td>
                      <td style={{padding:"9px 16px"}}>{h.crew&&<span className="fm" style={{padding:"2px 7px",background:"rgba(200,16,46,0.15)",color:"#FF6B6B",fontWeight:700,fontSize:11,borderRadius:2}}>{h.crew}</span>}</td>
                      <td className="fm" style={{padding:"9px 16px",textAlign:"right",fontWeight:700,color:T.text}}>{h.reading?fmt(parseInt(h.reading)):"-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:"15px 22px",borderTop:`1px solid ${T.border}`,background:T.surfaceBd,display:"flex",justifyContent:"flex-end",gap:10}}>
              <button onClick={()=>xVehicle(modal.vehicle)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"rgba(30,132,73,0.8)",color:"#fff",border:"none",cursor:"pointer",fontWeight:700,fontSize:12,borderRadius:3}}>
                <FileSpreadsheet size={13}/> History XLSX
              </button>
              <button onClick={()=>openPDF(modal.vehicle,modal.history)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontWeight:700,fontSize:12,borderRadius:3,boxShadow:"0 2px 12px rgba(200,16,46,0.4)"}}>
                <FileText size={13}/> PDF Letterhead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ST({ eyebrow, title, sub }) {
  return (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:10,color:T.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.32em"}}>{eyebrow}</div>
      <div className="fd" style={{fontSize:27,fontWeight:900,color:T.text,marginTop:5,lineHeight:1.1}}>{title}</div>
      {sub&&<p style={{fontSize:13,color:T.textSub,marginTop:6,maxWidth:740,lineHeight:1.65}}>{sub}</p>}
    </div>
  );
}

function KV({ icon, label, value, sub, accent, onExport, tag }) {
  return (
    <div className={accent?"gw-card":"gw-card-gold"} style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:9.5,color:T.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.22em"}}>{label}</div>
        <div style={{color:accent?T.red:T.gold,opacity:.8}}>{icon}</div>
      </div>
      <div className="fd" style={{fontSize:34,fontWeight:900,color:accent?T.red:T.gold,marginBottom:8,lineHeight:1}}>{value}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{fontSize:12,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{sub}</div>
        {onExport&&<button onClick={onExport} className="pill"><Download size={10}/> {tag}</button>}
      </div>
    </div>
  );
}

function BC({ bk, onExport, onPick }) {
  const [all,setAll]=useState(false);
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:`3px solid ${bk.color}`,display:"flex",flexDirection:"column",boxShadow:`0 2px 12px rgba(0,0,0,0.3),0 0 0 1px ${bk.color}22`}}>
      <div style={{padding:"16px 16px 10px"}}>
        <div style={{fontSize:9,color:bk.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em"}}>{bk.label}</div>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginTop:8}}>
          <div className="fd" style={{fontSize:30,fontWeight:900,color:T.text}}>{fmt(bk.vehicles.length)}</div>
          <div style={{fontSize:10,color:T.textDim,fontWeight:600,textTransform:"uppercase"}}>unique</div>
        </div>
      </div>
      <div style={{flex:1,padding:"10px 16px",background:T.surfaceBd,borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:9,color:T.textDim,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Top vehicles</div>
        <div style={{maxHeight:148,overflowY:"auto"}}>
          {bk.vehicles.length===0&&<div style={{fontSize:11,color:T.textDim,fontStyle:"italic"}}>None in this band.</div>}
          {bk.vehicles.slice(0,all?50:5).map((v)=>(
            <button key={v.vehicle} onClick={()=>onPick(v.vehicle)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"4px 5px",borderRadius:2,marginBottom:1,transition:"background .1s"}}
              onMouseEnter={(e)=>e.currentTarget.style.background=T.surfaceHi}
              onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
              <span className="fm" style={{fontSize:11,fontWeight:700,color:T.text}}>{v.vehicle}</span>
              <span className="fm" style={{fontSize:11,color:bk.color}}>{fmt(v.maxKm)} km</span>
            </button>
          ))}
        </div>
        {bk.vehicles.length>5&&!all&&<button onClick={()=>setAll(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:bk.color,fontWeight:700,textTransform:"uppercase",marginTop:6}}>+{bk.vehicles.length-5} more</button>}
      </div>
      <button onClick={onExport} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:10,background:bk.color,color:"#fff",border:"none",cursor:"pointer",fontWeight:700,fontSize:12,transition:"opacity .15s"}}
        onMouseEnter={(e)=>e.currentTarget.style.opacity=".85"}
        onMouseLeave={(e)=>e.currentTarget.style.opacity="1"}>
        <FileSpreadsheet size={13}/> Download .xlsx
      </button>
    </div>
  );
}

function ChHdr({ title, sub, onExport }) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",paddingBottom:12,borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
      <div>
        <div className="fd" style={{fontSize:17,fontWeight:900,color:T.text}}>{title}</div>
        <div style={{fontSize:10,color:T.textSub,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.18em",marginTop:3}}>{sub}</div>
      </div>
      {onExport&&<button onClick={onExport} className="pill"><Download size={10}/> XLSX</button>}
    </div>
  );
}

function PB({ children, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{padding:7,background:disabled?T.surfaceBd:T.surfaceHi,border:`1px solid ${T.border}`,cursor:disabled?"not-allowed":"pointer",color:disabled?T.textDim:T.text,borderRadius:3,transition:"all .15s"}}>
      {children}
    </button>
  );
}

function FC({ icon, label, children }) {
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:T.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.22em",marginBottom:9}}>{icon}{label}</div>
      <div style={{fontSize:12,color:T.textSub,lineHeight:1.75}}>{children}</div>
    </div>
  );
}
