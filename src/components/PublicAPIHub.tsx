import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, Search, CheckCircle2, AlertCircle, 
  ExternalLink, ShieldCheck, Zap, Database, 
  Settings2, Info, HelpCircle, X, Plus, Play, 
  RefreshCw, Filter, Star, Lock, Unlock, 
  Settings, Layers, Download, Trash2, Undo, Redo,
  SearchX, ChevronLeft, ChevronRight, ChevronDown,
  LayoutGrid, FileUp, Files, Monitor, Palette,
  Keyboard, GripVertical, Eye, EyeOff, ArrowUp,
  ArrowDown, Save, Bookmark, Brain, MousePointer2,
  Move, ShieldAlert, Type as TypeIcon, Square,
  Highlighter, Sun, Moon, Barcode, QrCode
} from 'lucide-react';
import { PublicAPI, RECOMMENDED_APIS, fetchPublicAPIs } from '../services/publicApiService';
import { cn } from '../lib/utils';

export function PublicAPIHub({ onBack }: { onBack: () => void }) {
  const [apis, setApis] = useState<PublicAPI[]>(RECOMMENDED_APIS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const categories = Array.from(new Set(apis.map(a => a.category)));

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.name.toLowerCase().includes(search.toLowerCase()) || 
                         api.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || api.category === filter;
    return matchesSearch && matchesFilter;
  });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchPublicAPIs();
      setApis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Public API Hub</h2>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">
            Integrate working APIs from the public-apis registry to enhance your redaction workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform"
          >
            Back to Editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search APIs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
            />
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">Categories</h3>
            <button 
              onClick={() => setFilter(null)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors",
                !filter ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors",
                  filter === cat ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">Verified Working</span>
            </div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-500 font-medium leading-relaxed">
              These APIs have been tested for compatibility with Redactio's redaction engine.
            </p>
          </div>
        </div>

        {/* API Grid */}
        <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredApis.map((api, i) => (
              <motion.div
                key={api.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Relevance Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="text-[10px] font-black">{api.relevance}/10</span>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Database className="w-6 h-6 text-neutral-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight group-hover:text-black dark:group-hover:text-white transition-colors">{api.name}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{api.category}</span>
                  </div>
                </div>

                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed mb-6 h-10 line-clamp-2">
                  {api.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {api.auth === 'apiKey' ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-emerald-500" />}
                      <span className="text-[10px] font-bold uppercase">{api.auth === 'apiKey' ? 'Key Req' : 'Free'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-bold uppercase">CORS: {api.cors}</span>
                    </div>
                  </div>
                  <a 
                    href={api.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black rounded-xl transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredApis.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-neutral-400">
              <SearchX className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-black tracking-tight">No APIs found matching your criteria</p>
              <button onClick={() => { setSearch(''); setFilter(null); }} className="mt-4 text-sm font-bold underline">Clear all filters</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
