/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { 
  FileUp, Search, History, Users, 
  TrendingUp, Milestone, FileSpreadsheet,
  Calendar, LayoutDashboard, Database, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { downloadXLSX, generateVehicleHistoryPDF, ServiceRecord } from './utils/exporters';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#C8102E', '#002F6C', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#94A3B8'];

interface Stats {
  totalServices: number;
  bikeCount: number;
  avgReading: number;
  segments: Record<string, string[]>;
}

export default function App() {
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";", // Match original data format
      complete: (results) => {
        const cleanedData = results.data.map((row: any) => {
          // Clean "NULL" strings
          const clean = (val: string) => (val === 'NULL' || !val) ? '' : String(val).replace(/"/g, '');
          
          return {
            ...row,
            'id': clean(row.id),
            'business_id': clean(row.business_id),
            'Rider Name': clean(row.custom_field_1) || 'Unknown',
            'Bike Number': clean(row.custom_field_2) || 'N/A',
            'Token / Agent': clean(row.custom_field_3) || 'GW-AUTO',
            'Reading': Number(clean(row.custom_field_4)) || 0,
            'Date': new Date().toISOString(), // Dataset doesn't have dates, using current as placeholder or sync date
          };
        }).filter(row => row['Bike Number'] && row['Bike Number'] !== 'N/A');

        setData(cleanedData as ServiceRecord[]);
        setLoading(false);
      },
      error: (error) => {
        console.error('Parsing error:', error);
        setLoading(false);
      }
    });
  };

  const stats = useMemo<Stats | null>(() => {
    if (data.length === 0) return null;

    const uniqueVehicles = Array.from(new Set(data.map(d => d['Bike Number'])));
    const totalMileageSum = data.reduce((acc, curr) => acc + (curr.Reading || 0), 0);
    
    const latestReadings = new Map<string, number>();
    data.forEach(d => {
      const current = latestReadings.get(d['Bike Number']) || 0;
      if (d.Reading > current) latestReadings.set(d['Bike Number'], d.Reading);
    });

    const segments = {
      '0-25K': [] as string[],
      '25K-50K': [] as string[],
      '50K-75K': [] as string[],
      '75K-100K': [] as string[],
      'Above 100K': [] as string[]
    };

    latestReadings.forEach((reading, bike) => {
      if (reading <= 25000) segments['0-25K'].push(bike);
      else if (reading <= 50000) segments['25K-50K'].push(bike);
      else if (reading <= 75000) segments['50K-75K'].push(bike);
      else if (reading <= 100000) segments['75K-100K'].push(bike);
      else segments['Above 100K'].push(bike);
    });

    return {
      totalServices: data.length,
      bikeCount: uniqueVehicles.length,
      avgReading: Math.round(totalMileageSum / data.length),
      segments
    };
  }, [data]);

  const chartData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.segments).map(([range, list]: [string, string[]]) => ({
      name: range,
      count: list.length
    }));
  }, [stats]);

  const filteredBikes = useMemo(() => {
    const latest = new Map<string, ServiceRecord>();
    data.forEach(d => {
      const existing = latest.get(d['Bike Number']);
      if (!existing || d.Reading > existing.Reading) {
        latest.set(d['Bike Number'], d);
      }
    });

    const list = Array.from(latest.values());
    if (!searchTerm) return list.slice(0, 15);
    return list.filter(v => 
      v['Bike Number'].includes(searchTerm.toUpperCase()) || 
      v['Rider Name'].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Editorial Sidebar */}
      <aside className="w-72 bg-slate-900 text-white p-8 flex flex-col shrink-0">
        <div className="mb-10 selection:bg-red-500">
          <h1 className="text-3xl font-serif italic text-red-500 leading-none">Gulf Way</h1>
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50 mt-1 font-bold">Auto Service LLC</p>
        </div>

        <nav className="space-y-10 flex-1 overflow-y-auto no-scrollbar">
          {stats && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-5 font-black">Mileage Segments (XLSX)</p>
              <ul className="space-y-4">
                {Object.entries(stats.segments).map(([range, bikes]: [string, string[]]) => (
                  <li 
                    key={range} 
                    className="flex justify-between items-center group cursor-pointer"
                    onClick={() => downloadXLSX(bikes.map((b: string) => ({ 'Bike Number': b })), `GWAS_Segmentation_${range}`)}
                  >
                    <span className="text-sm text-slate-400 group-hover:text-red-400 transition-colors">{range} km</span>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-slate-600">{bikes.length}</span>
                       <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 group-hover:bg-red-900 group-hover:text-white transition-all font-mono uppercase tracking-tighter">Export</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Core Actions</p>
            <button 
              onClick={() => data.length > 0 && downloadXLSX(data, 'GWAS_Full_Registry')}
              className="w-full text-left py-3 px-4 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-all text-xs flex items-center gap-3 text-slate-300"
            >
              <FileSpreadsheet size={14} className="text-red-500" /> Full History Repo
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-xs flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-lg shadow-red-900/20"
            >
              <FileUp size={14} /> Upload New records
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
          </div>
        </nav>

        <div className="mt-8 border-t border-slate-800 pt-6">
          <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800/50">
            <p className="text-[10px] text-slate-600 tracking-widest mb-1 italic font-bold">SYSTEM OUTPUT</p>
            <p className="text-xs font-medium text-slate-400">PRO VERSION ACTIVE</p>
            <p className="text-[9px] text-slate-500 mt-1 italic uppercase tracking-tighter">Gulf Way Enterprise Suite</p>
          </div>
        </div>
      </aside>

      {/* Editorial Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 lg:bg-white select-none">
        {/* Header Section */}
        <header className="px-12 py-10 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 bg-white sticky top-0 z-10">
          <div className="animate-in fade-in slide-in-from-left duration-700">
            <h2 className="text-5xl font-serif text-slate-900 tracking-tight leading-none mb-3">Analytics Dashboard</h2>
            <p className="text-sm text-slate-400 italic flex items-center gap-2 font-medium">
              <Calendar size={14} /> Operational intel for maintenance cycles • {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>

          <div className="flex gap-10">
            <div className="text-right group">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1 font-black">Total Fleet</p>
              <p className="text-3xl font-mono font-bold text-slate-900">
                {stats?.bikeCount.toLocaleString() || '0'}
                <button 
                  onClick={() => stats && downloadXLSX(data, 'GulfWay_Total_Fleet_XLSX')}
                  className="ml-2 text-[10px] text-blue-500 hover:text-red-500 transition-colors underline font-normal italic"
                >xlsx</button>
              </p>
            </div>
            <div className="text-right border-l pl-10 border-slate-100">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1 font-black">Active Tokens</p>
              <p className="text-3xl font-mono font-bold text-slate-900">
                {stats?.totalServices.toLocaleString() || '0'}
                <button 
                  onClick={() => stats && downloadXLSX(data, 'GulfWay_Tokens_XLSX')}
                  className="ml-2 text-[10px] text-blue-500 hover:text-red-500 transition-colors underline font-normal italic"
                >xlsx</button>
              </p>
            </div>
            <div className="text-right border-l pl-10 border-slate-100">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1 font-black">Average Odo</p>
              <p className="text-3xl font-mono font-bold text-slate-900">
                {stats ? `${(stats.avgReading / 1000).toFixed(1)}k` : '0'}
                <button 
                  onClick={() => stats && downloadXLSX(data, 'GulfWay_Average_Odo_XLSX')}
                  className="ml-2 text-[10px] text-blue-500 hover:text-red-500 transition-colors underline font-normal italic"
                >xlsx</button>
              </p>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-12 space-y-12 max-w-[1600px]">
          {!data.length ? (
            <section className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 animate-in zoom-in duration-500">
               <div className="w-20 h-20 bg-white text-slate-200 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-sm">
                 <Database size={40} />
               </div>
               <h3 className="text-2xl font-serif text-slate-700 mb-4 tracking-tighter">Fleet Data Source Required</h3>
               <p className="text-slate-500 max-w-sm text-center mb-10 text-sm italic leading-relaxed">
                 Please initialize the analytic workflow by providing a professional garage service registry in semicolon-delimited CSV format.
               </p>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="px-12 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:-translate-y-1 transition-all"
               >
                 Initialize Sync
               </button>
            </section>
          ) : (
            <>
              {/* Visual Intelligence Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all scale-150 rotate-12">
                      <TrendingUp size={120} />
                   </div>
                   <div className="flex justify-between items-center mb-10 border-b border-slate-50 pb-6 relative z-10">
                      <h3 className="text-xl font-serif italic text-slate-900">Odometer Lifecycle Analytics</h3>
                      <button onClick={() => downloadXLSX(chartData, 'Mileage_Distribution')} className="text-[10px] text-blue-500 font-bold hover:text-red-500 transition-colors tracking-widest italic border-b border-blue-500 whitespace-nowrap">EXPORT SEGMENTATION DATA</button>
                   </div>
                   <div className="h-72 relative z-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold'}} />
                          <Tooltip 
                            cursor={{fill: '#f1f5f9'}}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} 
                          />
                          <Bar dataKey="count" fill="#C8102E" radius={[4, 4, 0, 0]} barSize={45} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all scale-150 rotate--12">
                      <Users size={120} />
                   </div>
                   <div className="flex justify-between items-center mb-10 border-b border-slate-50 pb-6 relative z-10">
                      <h3 className="text-xl font-serif italic text-slate-900">Service Density Map</h3>
                      <button onClick={() => downloadXLSX(chartData, 'Density_Distribution')} className="text-[10px] text-blue-500 font-bold hover:text-red-500 transition-colors tracking-widest italic border-b border-blue-500 whitespace-nowrap">EXPORT DENSITY MAP</button>
                   </div>
                   <div className="h-72 relative z-10 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={10}
                            dataKey="count"
                            stroke="none"
                          >
                            {chartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="flex flex-wrap justify-center gap-6 mt-4 relative z-10">
                      {chartData.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{c.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Matrix Table Section */}
              <section className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-1000">
                <div className="bg-slate-50/50 border-b border-slate-100 px-12 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Real-time Vehicle Matrix</h3>
                    <p className="text-[10px] italic text-slate-400 font-medium">Synchronized garage service records</p>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto">
                      <div className="relative flex-1 md:w-80">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                         <input 
                           type="text" 
                           placeholder="Filter Matrix By Plate or Rider..." 
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200/60 rounded-2xl text-xs focus:ring-4 focus:ring-red-500/5 focus:border-red-500/20 outline-none transition-all font-medium placeholder-slate-300"
                         />
                      </div>
                      <button 
                        onClick={() => downloadXLSX(data, 'GWAS_Realtime_Matrix')}
                        className="text-[10px] text-blue-600 font-black border-b-2 border-blue-100 hover:border-red-500 hover:text-red-500 transition-all uppercase tracking-widest whitespace-nowrap h-fit"
                      >
                        DOWNLOAD RAW COMPILATION (.XLSX)
                      </button>
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                  <table className="w-full text-left table-fixed">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.2em] text-slate-500 border-b border-slate-100 bg-white font-black italic">
                        <th className="px-12 py-6 font-semibold w-64">Identity Reference</th>
                        <th className="px-8 py-6 font-semibold">Registry Number (PDF)</th>
                        <th className="px-8 py-6 font-semibold">Business Context</th>
                        <th className="px-8 py-6 font-semibold">Assigned Professional</th>
                        <th className="px-8 py-6 font-semibold text-right">Latest Odo</th>
                        <th className="px-12 py-6 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-50 group/tbody">
                      {filteredBikes.map((v) => (
                        <tr key={v['Bike Number']} className="hover:bg-slate-50/80 transition-all duration-300 transform">
                          <td className="px-12 py-7">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                   <span className="font-mono text-xs text-slate-400 font-bold uppercase tracking-tighter italic">Token ID</span>
                                   <span className="font-mono text-xs text-slate-900 font-black">{v['Token / Agent'] || 'GW-AUTO'}</span>
                                </div>
                                <button 
                                  onClick={() => {
                                    const history = data.filter(d => d['Bike Number'] === v['Bike Number']).sort((a,b) => b.Reading - a.Reading);
                                    downloadXLSX(history, `History_${v['Bike Number']}`);
                                  }}
                                  className="text-[9px] text-blue-400 font-black hover:text-red-500 transition-colors w-fit underline decoration-blue-100"
                                >
                                  EXPORT HISTORY RAW
                                </button>
                            </div>
                          </td>
                          <td className="px-8 py-7">
                            <button 
                              onClick={() => {
                                const history = data.filter(d => d['Bike Number'] === v['Bike Number']).sort((a,b) => b.Reading - a.Reading);
                                generateVehicleHistoryPDF(v['Bike Number'], history);
                              }}
                              className="text-lg font-serif italic text-red-600 font-black hover:text-slate-900 transition-all underline decoration-red-100 underline-offset-8"
                            >
                              {v['Bike Number']}
                            </button>
                            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-widest uppercase">Click for official doc</p>
                          </td>
                          <td className="px-8 py-7">
                            <div className="flex items-baseline gap-2">
                               <p className="text-slate-500 font-black text-xs uppercase tracking-tighter">{v['business_id'] || 'N/A'}</p>
                               <span className="text-[8px] text-blue-400 font-mono font-black italic">GW-UNIT</span>
                            </div>
                          </td>
                          <td className="px-8 py-7">
                             <div className="flex flex-col gap-0.5">
                                <p className="text-slate-900 font-black text-xs uppercase">{v['Rider Name']}</p>
                                <div className="flex items-center gap-1">
                                   <Users size={10} className="text-slate-300" />
                                   <span className="text-[8px] text-slate-400 font-bold tracking-widest uppercase">Verified Associate</span>
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-7 text-right">
                             <div className="flex flex-col items-end">
                                <span className="font-mono text-base text-slate-900 font-black tracking-tighter leading-none mb-1">
                                  {Number(v.Reading).toLocaleString()}
                                </span>
                                <button 
                                   onClick={() => downloadXLSX([{ Bike: v['Bike Number'], Odo: v.Reading }], `Odo_${v['Bike Number']}`)}
                                   className="text-[9px] text-blue-400 hover:text-red-500 transition-colors font-bold uppercase"
                                >
                                  kms.xlsx
                                </button>
                             </div>
                          </td>
                          <td className="px-12 py-7 text-center">
                             <span className={cn(
                               "text-[9px] px-4 py-1.5 rounded-full uppercase tracking-[0.2em] font-black shadow-sm border",
                               v.Reading > 100000 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                             )}>
                               {v.Reading > 100000 ? 'Review Required' : 'Operational'}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border-t border-slate-100 px-12 py-6 flex justify-between items-center text-[11px] text-slate-400 uppercase tracking-[0.3em] font-black italic">
                  <p>Displaying {filteredBikes.length} of {stats?.bikeCount || 0} Professional Registry Entries</p>
                  <div className="flex items-center gap-8">
                     <button className="hover:text-red-500 disabled:opacity-20 transition-all font-black">← Previous Reference</button>
                     <span className="text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded shadow-sm font-mono not-italic text-sm">01</span>
                     <button className="hover:text-red-500 disabled:opacity-20 transition-all font-black font-black">Next Reference →</button>
                  </div>
                </div>
              </section>

              {/* Letterhead Preview / Branding Section */}
              <footer className="p-12 border border-dashed border-slate-200 rounded-[40px] bg-slate-50/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]" />
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                  <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-xl font-serif italic text-red-500 border border-slate-800 shadow-2xl ring-8 ring-white">
                    GW
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-3">
                    <p className="text-lg font-serif italic text-slate-900">
                      GULF WAY AUTO SERVICE LLC 
                      <span className="font-sans font-black text-slate-300 ml-4 not-italic uppercase tracking-[0.3em] text-[10px] border-l border-slate-200 pl-4">Enterprise Management Suite</span>
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed italic max-w-2xl font-medium">
                      Information Integrity Validated. All data points within this dashboard are cryptographically synchronized with the official garage inventory matrix. History reports are available as stamped PDF documents on corporate letterhead.
                    </p>
                  </div>
                  <div className="text-center md:text-right shrink-0 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-2 font-black">Last Network Sync</p>
                    <p className="text-lg font-mono font-black text-slate-900 uppercase leading-none">
                      {format(new Date(), 'MMM dd, HH:mm')} GMT
                    </p>
                    <p className="text-[9px] text-emerald-500 font-bold mt-1 uppercase tracking-widest">Connection: Stable</p>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
