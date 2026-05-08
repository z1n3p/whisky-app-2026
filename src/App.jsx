import { useState, useEffect } from 'react';
import whiskies from '../whiskies.json';
import { supabase } from '../supabaseClient';
import { 
  Ticket, User, CheckCircle2, XCircle, Loader2, Search, 
  Trophy, Users, PlusCircle, BarChart3, Activity, 
  Info, ChevronDown, ChevronUp, Flame, Trash2, Filter, X, Crown, Zap, Beer
} from 'lucide-react';

const ADMIN_PASSWORD = "7175"; 

function App() {
  const [user, setUser] = useState(null);
  const [coupons, setCoupons] = useState(0);
  const [tasted, setTasted] = useState({});
  const [allStats, setAllStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingCoupons, setIsEditingCoupons] = useState(false);
  const [tempCoupons, setTempCoupons] = useState(0);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [selectedUserForLogin, setSelectedUserForLogin] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchKup, setSearchKup] = useState("");
  const [showOnlyTasted, setShowOnlyTasted] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchAllStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) fetchUserData();
  }, [user]);

  async function fetchAllStats() {
    const { data } = await supabase.from('user_stats').select('*').order('updated_at', { ascending: false });
    if (data) setAllStats(data);
  }

  async function fetchUserData() {
    setLoading(true);
    const { data } = await supabase.from('user_stats').select('*').eq('username', user).single();
    if (data) {
      setCoupons(data.coupons || 0);
      setTasted(data.tasted_ids || {});
    }
    setLoading(false);
  }

  async function updateSupabase(newCoupons, newTasted) {
    await supabase.from('user_stats').update({ 
      coupons: newCoupons, 
      tasted_ids: newTasted,
      updated_at: new Date().toISOString() 
    }).eq('username', user);
    fetchAllStats();
  }

  const handleAction = async (id, type, cost) => {
    if (tasted[id] || coupons < cost) return;
    const newCoupons = coupons - cost;
    const newTasted = { ...tasted, [id]: type };
    setCoupons(newCoupons);
    setTasted(newTasted);
    await updateSupabase(newCoupons, newTasted);
  };

  const undoAction = async (id, cost) => {
    const newTasted = { ...tasted };
    delete newTasted[id];
    const newCoupons = coupons + cost;
    setCoupons(newCoupons);
    setTasted(newTasted);
    await updateSupabase(newCoupons, newTasted);
  };

  const saveManualCoupons = async () => {
    const newAmount = parseInt(tempCoupons) || 0;
    setCoupons(newAmount);
    await supabase.from('user_stats').update({ coupons: newAmount, updated_at: new Date().toISOString() }).eq('username', user);
    fetchAllStats();
    setIsEditingCoupons(false);
  };

  const clearFilters = () => {
    setSearchName("");
    setSearchKup("");
    setShowOnlyTasted(false);
  };

  const globalTally = allStats.reduce((acc, curr) => {
    const ids = curr.tasted_ids || {};
    Object.keys(ids).forEach(id => {
      if (ids[id] === 'good') acc[id] = (acc[id] || 0) + 1;
    });
    return acc;
  }, {});

  const top5 = Object.entries(globalTally)
    .map(([id, count]) => ({ ...whiskies.find(w => w.id === id), count }))
    .filter(w => w.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // --- BERÄKNA HIGHSCORE ---
  const leaderBoard = allStats.map(u => {
    const tastedIds = Object.keys(u.tasted_ids || {});
    const tastedWhiskies = tastedIds.map(id => whiskies.find(w => w.id === id)).filter(Boolean);
    
    return {
      name: u.username,
      count: tastedIds.length,
      spent: tastedWhiskies.reduce((acc, w) => acc + (w.kup || 0), 0),
      strongest: tastedWhiskies.length > 0 ? Math.max(...tastedWhiskies.map(w => parseFloat(w.strength.replace(',', '.')))) : 0
    };
  });

  const mostTasted = [...leaderBoard].sort((a,b) => b.count - a.count)[0];
  const mostSpent = [...leaderBoard].sort((a,b) => b.spent - a.spent)[0];
  const strongestDram = [...leaderBoard].sort((a,b) => b.strongest - a.strongest)[0];

  const filteredWhiskies = whiskies.filter(w => {
    const s = searchName.toLowerCase();
    const searchableText = `${w.name} ${w.id} ${w.region} ${w.smell} ${w.taste} ${w.overall || ""}`.toLowerCase();
    const matchesSearch = searchableText.includes(s);
    const matchesKup = searchKup === "" || w.kup.toString() === searchKup;
    const matchesTasted = !showOnlyTasted || tasted[w.id];
    return matchesSearch && matchesKup && matchesTasted;
  });

  const tastedList = Object.keys(tasted).map(id => whiskies.find(w => w.id === id)).filter(Boolean);
  const totalKupUsed = tastedList.reduce((acc, w) => acc + (w.kup || 0), 0);
  const topRegion = tastedList.length > 0 ? Object.entries(tastedList.reduce((acc, curr) => { acc[curr.region] = (acc[curr.region] || 0) + 1; return acc; }, {})).sort((a,b) => b[1] - a[1])[0][0] : "Ingen än";
  const avgStrength = tastedList.length > 0 ? (tastedList.reduce((acc, curr) => acc + parseFloat(curr.strength.replace(',', '.')), 0) / tastedList.length).toFixed(1) : "0";

  async function handleLogin() {
    const target = allStats.find(u => u.username === selectedUserForLogin);
    if (target && target.pin === loginPin) {
      setUser(target.username);
      setLoginPin("");
      setSelectedUserForLogin(null);
    } else { alert("Fel PIN-kod!"); }
  }

  async function handleCreateAccount() {
    if (!newName || newPin.length !== 4) return alert("Skriv namn och 4 siffror i PIN");
    const { error } = await supabase.from('user_stats').insert([{ username: newName, pin: newPin, coupons: 50, tasted_ids: {} }]);
    if (error) alert("Namnet är upptaget!");
    else { setShowCreateAccount(false); fetchAllStats(); }
  }

  async function handleDeleteUser(username) {
    if (confirm(`Radera ${username}?`)) {
      await supabase.from('user_stats').delete().eq('username', username);
      fetchAllStats();
    }
  }

  // --- KOMPONENTER ---

  const LiveFeed = () => (
    <div className="w-full mb-6 bg-zinc-900/30 border-y border-zinc-800/50 py-4 overflow-hidden">
      <div className="flex items-center gap-2 px-6 mb-3">
        <Activity size={12} className="text-green-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Just nu provas</span>
      </div>
      <div className="flex flex-col gap-2 px-6">
        {allStats.filter(u => Object.keys(u.tasted_ids || {}).length > 0).slice(0, 3).map((u, i) => {
          const ids = Object.keys(u.tasted_ids);
          const lastId = ids[ids.length - 1];
          const w = whiskies.find(x => x.id === lastId);
          return (
            <div key={i} className="text-[11px] flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
              <span className="text-amber-500 font-bold">{u.username}</span>
              <span className="text-zinc-500 italic">smakade</span>
              <span className="text-white font-medium truncate max-w-[150px]">{w?.name}</span>
              <span>{u.tasted_ids[lastId] === 'good' ? '👍' : '👎'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const HighScore = () => (
    <div className="bg-zinc-900/80 p-6 rounded-[32px] border border-zinc-800 mb-8 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="text-yellow-500" size={20} />
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Kvällens Ledartavla</h2>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {mostTasted?.count > 0 && (
          <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-2 rounded-xl text-amber-500"><Zap size={16} /></div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Flest sorter</p>
                <p className="text-xs font-bold text-white">{mostTasted.name}</p>
              </div>
            </div>
            <p className="text-sm font-black text-amber-500">{mostTasted.count}st</p>
          </div>
        )}

        {mostSpent?.spent > 0 && (
          <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl text-blue-500"><Ticket size={16} /></div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Störst budget</p>
                <p className="text-xs font-bold text-white">{mostSpent.name}</p>
              </div>
            </div>
            <p className="text-sm font-black text-blue-500">{mostSpent.spent} KUP</p>
          </div>
        )}

        {strongestDram?.strongest > 0 && (
          <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/20 p-2 rounded-xl text-red-500"><Flame size={16} /></div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Tuffast strupe</p>
                <p className="text-xs font-bold text-white">{strongestDram.name}</p>
              </div>
            </div>
            <p className="text-sm font-black text-red-500">{strongestDram.strongest}%</p>
          </div>
        )}
      </div>
    </div>
  );

  const TopList = () => (
    <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[32px] border border-amber-900/20 shadow-2xl mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-amber-500" size={20} />
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-amber-500">Folkets Favoriter</h2>
      </div>
      <div className="space-y-3">
        {top5.map((w, i) => (
          <div key={w.id} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-zinc-700 w-4">{i + 1}</span>
              <div>
                <p className="text-xs font-bold text-white line-clamp-1">{w.name}</p>
                <p className="text-[10px] text-zinc-500 uppercase">{w.region}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-black text-amber-500">{w.count} gillningar</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white py-12 flex flex-col items-center px-6 font-sans">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-amber-500 italic uppercase tracking-tighter">Whisky</h1>
            <p className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-bold">Digital Provningsbricka</p>
          </div>
          
          <LiveFeed />
          <HighScore />
          <TopList />

          <div className="space-y-6">
            {!selectedUserForLogin && !showCreateAccount ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {allStats.map(u => (
                    <div key={u.username} className="relative">
                      <button onClick={() => setSelectedUserForLogin(u.username)} className="w-full bg-zinc-900 p-4 rounded-2xl font-bold text-sm border border-zinc-800 uppercase tracking-tighter truncate">
                        {u.username}
                      </button>
                      {isAdminMode && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.username); }} className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full text-white shadow-lg">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowCreateAccount(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-zinc-800 text-zinc-500 font-bold text-sm flex items-center justify-center gap-2">
                  <PlusCircle size={18} /> Ny profil
                </button>
                <button onClick={() => {const p = prompt("Admin PIN:"); if(p === ADMIN_PASSWORD) setIsAdminMode(!isAdminMode)}} className="w-full text-[9px] text-zinc-800 uppercase tracking-widest mt-4 opacity-20">{isAdminMode ? "Exit Admin" : "Admin Mode"}</button>
              </>
            ) : selectedUserForLogin ? (
              <div className="bg-zinc-900 p-8 rounded-[32px] border border-amber-500/50 text-center">
                <h2 className="text-xl font-bold text-amber-500 mb-6 uppercase italic">Hej {selectedUserForLogin}!</h2>
                <input type="password" inputMode="numeric" maxLength="4" placeholder="PIN" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-center text-2xl tracking-[0.5em] outline-none mb-6" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} autoFocus />
                <div className="flex gap-3">
                  <button onClick={() => setSelectedUserForLogin(null)} className="flex-1 p-3 text-xs font-bold text-zinc-500 uppercase">TILLBAKA</button>
                  <button onClick={handleLogin} className="flex-1 bg-amber-600 p-3 rounded-xl font-black uppercase text-xs">Logga in</button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-4">
                <h2 className="text-xl font-black text-center text-zinc-300 uppercase italic">Skapa konto</h2>
                <input type="text" placeholder="Namn" className="w-full bg-black border border-zinc-800 rounded-xl p-4 outline-none" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input type="password" inputMode="numeric" maxLength="4" placeholder="4 siffror" className="w-full bg-black border border-zinc-800 rounded-xl p-4 outline-none" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowCreateAccount(false)} className="flex-1 p-3 text-xs font-bold text-zinc-500 uppercase">AVBRYT</button>
                  <button onClick={handleCreateAccount} className="flex-1 bg-green-600 p-3 rounded-xl font-black uppercase text-xs">Skapa</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-20 font-sans">
      <div className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800 p-5">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div onClick={() => { setTempCoupons(coupons); setIsEditingCoupons(true); }} className="cursor-pointer">
            <h2 className="text-amber-500 font-black flex items-center gap-1.5 uppercase tracking-widest text-[9px] mb-1"><User size={10}/> {user}</h2>
            <div className="flex items-center gap-2 text-2xl font-black">
              <Ticket className="text-amber-500" size={22} /> {coupons}
            </div>
          </div>
          <div className="flex items-center gap-4 px-4 border-x border-zinc-800/50">
            <div className="text-center">
              <p className="text-[7px] text-zinc-500 uppercase font-bold">Region</p>
              <p className="text-[10px] text-white font-black italic uppercase">{topRegion}</p>
            </div>
            <div className="text-center">
              <p className="text-[7px] text-zinc-500 uppercase font-bold">Snitt %</p>
              <p className="text-[10px] text-white font-black italic uppercase">{avgStrength}%</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700/50 flex items-center gap-2">
              <Flame size={12} className="text-orange-500" />
              <span className="text-[9px] font-black text-white uppercase">{totalKupUsed} KUP</span>
            </div>
            <button onClick={() => setUser(null)} className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Logga ut</button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input type="text" placeholder="Sök smak, namn, doft..." className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-500/30" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
            </div>
            <div className="relative w-24">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input type="number" inputMode="numeric" placeholder="KUP" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 pl-9 pr-2 text-sm outline-none focus:border-amber-500/30" value={searchKup} onChange={(e) => setSearchKup(e.target.value)} />
            </div>
            {(searchName || searchKup || showOnlyTasted) && (
              <button onClick={clearFilters} className="bg-zinc-800 p-2.5 rounded-xl text-amber-500 hover:bg-zinc-700 transition-all border border-zinc-700 flex items-center justify-center shadow-lg"><X size={20} /></button>
            )}
          </div>
          <button onClick={() => setShowOnlyTasted(!showOnlyTasted)} className={`w-full py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${showOnlyTasted ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{showOnlyTasted ? "Visar endast druckna" : "Visa endast druckna"}</button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {!searchName && !searchKup && !showOnlyTasted && (
          <>
            <LiveFeed />
            <HighScore />
            <TopList />
          </>
        )}

        <div className="space-y-4">
          {filteredWhiskies.length > 0 ? (
            filteredWhiskies.map(w => (
              <div key={w.id} className={`p-5 rounded-[28px] border transition-all ${tasted[w.id] ? 'bg-zinc-900/30 border-zinc-900 opacity-60 scale-[0.98]' : 'bg-zinc-900 border-zinc-800 shadow-2xl'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono bg-black px-2 py-0.5 rounded text-amber-500 border border-amber-900/30 font-bold">{w.id}</span>
                      <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">{w.region}</span>
                      {globalTally[w.id] > 0 && (
                        <div className="flex items-center gap-1 text-zinc-600 ml-2">
                          <Users size={10} /><span className="text-[10px] font-bold">{globalTally[w.id]}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-lg leading-tight text-white mb-2">{w.name}</h3>
                    
                    <div className="mb-3">
                      <button onClick={() => setExpandedId(expandedId === w.id ? null : w.id)} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-zinc-500 hover:text-amber-500 transition-colors"><Info size={14} /> {expandedId === w.id ? "Dölj detaljer" : "Visa smak & info"}{expandedId === w.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                      {expandedId === w.id && (
                        <div className="mt-3 p-4 bg-black/40 rounded-2xl border border-zinc-800/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div><span className="text-[9px] uppercase font-black text-amber-500/70 block mb-1">Doft</span><p className="text-[12px] text-zinc-300 leading-relaxed italic">"{w.smell}"</p></div>
                          <div><span className="text-[9px] uppercase font-black text-amber-500/70 block mb-1">Smak</span><p className="text-[12px] text-zinc-300 leading-relaxed italic">"{w.taste}"</p></div>
                          {w.overall && (<div className="pt-2 border-t border-zinc-800/50"><span className="text-[9px] uppercase font-black text-amber-500/70 block mb-1">Helhet</span><p className="text-[12px] text-amber-100/90 leading-relaxed font-medium">{w.overall}</p></div>)}
                          {w.price && (<div className="text-[10px] text-zinc-500 font-mono pt-1">SB {w.sb_nr} • Pris: {w.price}</div>)}
                        </div>
                      )}
                    </div>
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-tighter">{w.strength} • {w.kup} KUP</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!tasted[w.id] ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(w.id, 'good', w.kup)} className="p-4 bg-zinc-800 hover:bg-green-600 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-90 border border-zinc-700 shadow-lg shadow-black"><CheckCircle2 size={24} /></button>
                        <button onClick={() => handleAction(w.id, 'bad', w.kup)} className="p-4 bg-zinc-800 hover:bg-red-600 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-90 border border-zinc-700 shadow-lg shadow-black"><XCircle size={24} /></button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black text-amber-500 uppercase italic bg-amber-500/10 px-2 py-1 rounded-lg">{tasted[w.id] === 'good' ? 'Gillades 🥃' : 'Ej din smak ❌'}</span>
                        <button onClick={() => undoAction(w.id, w.kup)} className="text-[9px] text-zinc-600 hover:text-white underline uppercase font-bold mt-1">Ångra</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center animate-bounce-slow">
              <div className="text-8xl mb-6">🥴</div>
              <h3 className="text-xl font-black text-amber-500 uppercase italic mb-2">Hoppsan!</h3>
              <p className="text-zinc-400 text-sm mb-8 px-12 leading-relaxed">Det du söker på finns inte, <br /><span className="text-zinc-500 font-bold">du kanske ska ta ett varv runt huset?</span></p>
              <button onClick={clearFilters} className="bg-zinc-900 text-zinc-400 border border-zinc-800 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:text-amber-500 transition-all shadow-xl">Gå tillbaka till flaskorna</button>
            </div>
          )}
        </div>
      </main>

      {isEditingCoupons && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
          <div className="bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 w-full max-w-xs text-center shadow-2xl">
            <p className="text-[10px] uppercase font-black text-zinc-500 mb-6 tracking-widest">Justera saldo</p>
            <input type="number" inputMode="numeric" className="bg-black border-2 border-amber-500 text-white w-full p-4 rounded-2xl text-4xl font-bold outline-none mb-6 text-center" value={tempCoupons} onChange={(e) => setTempCoupons(e.target.value)} autoFocus />
            <div className="flex gap-3">
               <button onClick={() => setIsEditingCoupons(false)} className="flex-1 p-3 text-xs font-bold text-zinc-500 uppercase">Avbryt</button>
               <button onClick={saveManualCoupons} className="flex-1 bg-amber-600 p-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-amber-900/20">Spara</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;