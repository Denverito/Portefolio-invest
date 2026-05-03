import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const ALPHA_VANTAGE_KEY = "1OJMNYO3P91249G9";

function useShake(onShake: () => void, threshold = 14) {
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0, lastTime = 0;
    const handle = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || {} as DeviceMotionEventAcceleration;
      const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
      const now = Date.now();
      if (now - lastTime < 200) return;
      const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
      if (delta > threshold) { onShake(); lastTime = now; }
      lastX = x; lastY = y; lastZ = z;
    };
    if (typeof DeviceMotionEvent !== "undefined") {
      const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DME.requestPermission === "function") {
        DME.requestPermission().then((p: string) => { if (p === "granted") window.addEventListener("devicemotion", handle); }).catch(() => {});
      } else { window.addEventListener("devicemotion", handle); }
    }
    return () => window.removeEventListener("devicemotion", handle);
  }, [onShake, threshold]);
}

interface NoteEntry { courtier: string; contact: string; conditions: string; remarques: string; }

const INITIAL = {
  stocks: [
    { id: 1, name: "IonQ", ticker: "IONQ", quantity: 100, buyPrice: 12.5, type: "Action" },
    { id: 2, name: "Alphabet", ticker: "GOOGL", quantity: 10, buyPrice: 140.0, type: "Action" },
    { id: 3, name: "QTUM ETF", ticker: "QTUM", quantity: 50, buyPrice: 55.0, type: "ETF" },
  ],
  crypto: [
    { id: 1, name: "Bitcoin", ticker: "BTC", coingeckoId: "bitcoin", quantity: 0.5, buyPrice: 42000 },
    { id: 2, name: "Ethereum", ticker: "ETH", coingeckoId: "ethereum", quantity: 3, buyPrice: 2200 },
  ],
  pe: [
    { id: 1, name: "Opale Secondaries II", amount: 90000, multiple: 2.07, end: 2034 },
    { id: 2, name: "Elevation Co-Invest", amount: 90100, multiple: 2.16, end: 2034 },
  ],
  immo: [
    { id: 1, name: "Résidence Toulouse", type: "bien", adresse: "12 rue des Paradoux", ville: "Toulouse", codePostal: "31000", surface: 65, prixAchatM2: 4307, value: 320000, acquisition: 280000, rent: 1100, charges: 200 },
  ],
  scpi: [
    { id: 1, name: "Primopierre", gestionnaire: "Primonial REIM", nbParts: 50, prixAchatPart: 1820, prixPartActuel: 1870, rendementAnnuel: 4.8, type: "Bureaux" },
    { id: 2, name: "Corum Origin", gestionnaire: "Corum AM", nbParts: 20, prixAchatPart: 1135, prixPartActuel: 1095, rendementAnnuel: 6.06, type: "Diversifié" },
  ],
  attente: [
    { id: 1, name: "Prêt familial", amount: 5000, beneficiaire: "Marc", dateRetour: "2025-06-01", statut: "En cours" },
  ],
  epargne: [
    { id: 1, banque: "BNP Paribas", produit: "Compte courant", montant: 8500, couleur: "#818cf8" },
    { id: 2, banque: "Crédit Agricole", produit: "Livret A", montant: 22950, couleur: "#34d399" },
    { id: 3, banque: "Boursorama", produit: "Compte épargne", montant: 15000, couleur: "#fbbf24" },
  ],
  enfants: {
    cesar: { pea: [{ id: 1, name: "LVMH", ticker: "MC.PA", quantity: 2, buyPrice: 680, type: "Action" }], livret: 3200 },
    juliette: { pea: [{ id: 1, name: "Air Liquide", ticker: "AI.PA", quantity: 3, buyPrice: 155, type: "Action" }], livret: 2800 },
  },
  notes: {
    "stocks_1": { courtier: "Trade Republic", contact: "", conditions: "Acheté après annonce Q2", remarques: "Surveiller résultats trimestriels" },
    "pe_1": { courtier: "Optyma / Opale Capital", contact: "Conseiller: Jean Dupont", conditions: "Appel de fonds partiel 84k€ nets", remarques: "Multiple projeté 2.07x — distributions dès 2029" },
    "pe_2": { courtier: "Optyma / Elevation", contact: "", conditions: "Appel de fonds 84k€ nets", remarques: "Multiple projeté 2.16x" },
  } as Record<string, NoteEntry>,
};

type AppData = typeof INITIAL;

const NOTE_CATEGORIES = [
  { key: "stocks", label: "Actions/ETF", icon: "📈", color: "#818cf8" },
  { key: "crypto", label: "Crypto", icon: "₿", color: "#34d399" },
  { key: "pe", label: "Private Equity", icon: "🏦", color: "#fbbf24" },
  { key: "immo", label: "Biens", icon: "🏠", color: "#f87171" },
  { key: "scpi", label: "SCPI", icon: "🏢", color: "#f87171" },
  { key: "attente", label: "En attente", icon: "💤", color: "#a78bfa" },
  { key: "epargne", label: "Épargne", icon: "🏧", color: "#38bdf8" },
];

const MARKET_DATA: Record<string, { ville: string; prixM2: number; tendance: number[]; annees: string[]; variation1an: number }> = {
  "31000": { ville: "Toulouse Centre", prixM2: 4250, tendance: [3680, 3820, 3950, 4080, 4250], annees: ["2021", "2022", "2023", "2024", "2025"], variation1an: 4.1 },
  "default": { ville: "Marché local", prixM2: 3500, tendance: [3200, 3300, 3400, 3450, 3500], annees: ["2021", "2022", "2023", "2024", "2025"], variation1an: 1.4 },
};
const SCPI_HISTORY: Record<string, { y: string; v: number }[]> = {
  "Primopierre": [{ y: "2020", v: 1820 }, { y: "2021", v: 1840 }, { y: "2022", v: 1860 }, { y: "2023", v: 1850 }, { y: "2024", v: 1870 }, { y: "2025", v: 1870 }],
  "Corum Origin": [{ y: "2020", v: 1085 }, { y: "2021", v: 1100 }, { y: "2022", v: 1135 }, { y: "2023", v: 1120 }, { y: "2024", v: 1100 }, { y: "2025", v: 1095 }],
};

const BANK_COLORS = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#38bdf8", "#fb923c", "#e879f9"];
const TABS = ["home", "actions", "crypto", "pe", "immo", "attente", "epargne", "enfants", "notes"];
const TAB_ICONS: Record<string, string> = { home: "◈", actions: "📈", crypto: "₿", pe: "🏦", immo: "🏠", attente: "💤", epargne: "🏧", enfants: "👨‍👧‍👦", notes: "📝" };
const TAB_LABELS: Record<string, string> = { home: "Accueil", actions: "Actions", crypto: "Crypto", pe: "P.E.", immo: "Immo", attente: "Attente", epargne: "Épargne", enfants: "Enfants", notes: "Notes" };

const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtD = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const pct = (v: number) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)}%`;
const getMarket = (cp: string) => MARKET_DATA[cp] || MARKET_DATA["default"];
const daysLeft = (dateStr: string) => {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (d < 0) return { label: `${Math.abs(d)}j de retard`, color: "#f87171" };
  if (d === 0) return { label: "Aujourd'hui", color: "#fbbf24" };
  return { label: `Dans ${d}j`, color: d < 30 ? "#fbbf24" : "#34d399" };
};

const STORAGE_KEY = "portfolio_data_v2";
const PIN_KEY = "portfolioPin";
const DEFAULT_PIN = "2505";

function loadPin(): string {
  return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
}

function savePin(pin: string) {
  localStorage.setItem(PIN_KEY, pin);
}

const AUTO_LOCK_KEY = "portfolioAutoLock";
const AUTO_LOCK_OPTIONS = [
  { label: "Désactivé", value: 0 },
  { label: "1 min", value: 1 },
  { label: "2 min", value: 2 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
];

function loadAutoLock(): number {
  const v = localStorage.getItem(AUTO_LOCK_KEY);
  return v !== null ? parseInt(v, 10) : 2;
}

const HISTORY_KEY = "portfolio_history_v1";
const MAX_HISTORY_DAYS = 365;

interface HistoryEntry { date: string; total: number; }

function loadHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch {}
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function upsertTodaySnapshot(history: HistoryEntry[], total: number): HistoryEntry[] {
  const today = todayStr();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_HISTORY_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = history.filter(e => e.date >= cutoffStr && e.date !== today);
  const updated = [...filtered, { date: today, total: Math.round(total) }]
    .sort((a, b) => a.date.localeCompare(b.date));
  saveHistory(updated);
  return updated;
}

function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.notes) parsed.notes = INITIAL.notes;
      return parsed;
    }
  } catch {}
  return INITIAL;
}

// ─── Lock Screen ─────────────────────────────────────────────────────────────
function LockScreen({ onUnlock, pinCode }: { onUnlock: () => void; pinCode: string }) {
  const [status, setStatus] = useState("idle");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const tryBiometric = useCallback(async () => {
    setStatus("scanning");
    try {
      if (!window.PublicKeyCredential) throw new Error("Non supporté");
      const pkc = window.PublicKeyCredential as unknown as { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean> };
      const available = await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) throw new Error("Pas de biométrie");
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const credIdStr = localStorage.getItem("portfolioCredId");
      const hostname = window.location.hostname || "localhost";
      if (!credIdStr) {
        const reg = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "Portfolio", id: hostname }, user: { id: new Uint8Array([1]), name: "user", displayName: "Utilisateur" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 30000 } });
        if (reg) { localStorage.setItem("portfolioCredId", btoa(String.fromCharCode(...new Uint8Array((reg as PublicKeyCredential).rawId)))); setStatus("success"); setTimeout(onUnlock, 700); }
      } else {
        const credId = Uint8Array.from(atob(credIdStr), c => c.charCodeAt(0));
        const auth = await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type: "public-key", id: credId }], userVerification: "required", timeout: 30000 } });
        if (auth) { setStatus("success"); setTimeout(onUnlock, 700); }
      }
    } catch { setStatus("fallback"); }
  }, [onUnlock]);

  useEffect(() => { setTimeout(tryBiometric, 500); }, []);

  const handlePin = (digit: string) => {
    const np = pin + digit;
    setPin(np);
    if (np.length === 4) {
      if (np === pinCode) { setStatus("success"); setTimeout(onUnlock, 600); }
      else { setError(true); setTimeout(() => { setPin(""); setError(false); }, 700); }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, gap: 24, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        .pb{width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;font-size:24px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .pb:active{background:rgba(129,140,248,.3);}
        .pd{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.4);transition:all .2s;}
        .pd.on{background:#818cf8;border-color:#818cf8;}
        @keyframes pu{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes es{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
      `}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{status === "success" ? "✅" : status === "error" ? "❌" : status === "scanning" ? "👆" : "🔐"}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Portfolio Tracker</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginTop: 4 }}>
          {status === "idle" && "Authentification requise"}
          {status === "scanning" && <span style={{ animation: "pu 1.5s infinite" }}>Vérification...</span>}
          {status === "success" && <span style={{ color: "#34d399" }}>Accès autorisé ✓</span>}
          {status === "fallback" && "Entrez votre code PIN"}
        </div>
      </div>
      {(status === "idle" || status === "scanning") && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: status === "scanning" ? "rgba(129,140,248,.2)" : "rgba(255,255,255,.06)", border: `2px solid ${status === "scanning" ? "#818cf8" : "rgba(255,255,255,.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, animation: status === "scanning" ? "pu 1.5s infinite" : "none", cursor: "pointer" }} onClick={tryBiometric}>👆</div>
          <button onClick={() => setStatus("fallback")} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Utiliser le code PIN</button>
        </div>
      )}
      {(status === "fallback" || status === "error") && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", gap: 16, animation: error ? "es 0.3s ease" : "none" }}>
            {[0, 1, 2, 3].map(i => <div key={i} className={`pd ${pin.length > i ? "on" : ""}`} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
              <button key={i} className="pb" style={{ visibility: k === "" ? "hidden" : "visible" }} onClick={() => k === "⌫" ? setPin(p => p.slice(0, -1)) : handlePin(String(k))}>{k}</button>
            ))}
          </div>
          <button onClick={tryBiometric} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>👆 Utiliser la biométrie</button>
        </div>
      )}
    </div>
  );
}

// ─── Shake Lock Overlay ───────────────────────────────────────────────────────
function ShakeLockOverlay({ onUnlock, pinCode }: { onUnlock: () => void; pinCode: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const tryBio = useCallback(async () => {
    try {
      const credIdStr = localStorage.getItem("portfolioCredId");
      if (!credIdStr) return;
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const credId = Uint8Array.from(atob(credIdStr), c => c.charCodeAt(0));
      await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type: "public-key", id: credId }], userVerification: "required", timeout: 20000 } });
      onUnlock();
    } catch {}
  }, [onUnlock]);

  useEffect(() => { setTimeout(tryBio, 300); }, []);

  const handlePin = (digit: string) => {
    const np = pin + digit; setPin(np);
    if (np.length === 4) {
      if (np === pinCode) { onUnlock(); }
      else { setError(true); setTimeout(() => { setPin(""); setError(false); }, 600); }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.97)", backdropFilter: "blur(16px)", zIndex: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        .pb2{width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#f1f5f9;font-size:22px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .pb2:active{background:rgba(129,140,248,.25);}
        .pd2{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.35);transition:all .2s;}
        .pd2.on{background:#818cf8;border-color:#818cf8;}
        @keyframes es2{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      `}</style>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9" }}>Portfolio verrouillé</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>Secouez ou entrez le PIN</div>
      <div style={{ display: "flex", gap: 14, animation: error ? "es2 0.3s ease" : "none" }}>
        {[0, 1, 2, 3].map(i => <div key={i} className={`pd2 ${pin.length > i ? "on" : ""}`} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
          <button key={i} className="pb2" style={{ visibility: k === "" ? "hidden" : "visible" }} onClick={() => k === "⌫" ? setPin(p => p.slice(0, -1)) : handlePin(String(k))}>{k}</button>
        ))}
      </div>
      <button onClick={tryBio} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>👆 Biométrie</button>
    </div>
  );
}

// ─── Change PIN Modal ─────────────────────────────────────────────────────────
function ChangePinModal({ currentPin, onSave, onClose }: { currentPin: string; onSave: (p: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<"current" | "new" | "confirm" | "done">("current");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState(false);

  const shake = () => { setError(true); setTimeout(() => { setPin(""); setError(false); }, 600); };

  const handleDigit = (digit: string) => {
    const np = pin + digit;
    setPin(np);
    if (np.length < 4) return;
    if (step === "current") {
      if (np === currentPin) { setPin(""); setStep("new"); }
      else shake();
    } else if (step === "new") {
      setNewPin(np); setPin(""); setStep("confirm");
    } else if (step === "confirm") {
      if (np === newPin) { savePin(np); onSave(np); setPin(""); setStep("done"); setTimeout(onClose, 1200); }
      else { setNewPin(""); setPin(""); setStep("new"); shake(); }
    }
  };

  const titles: Record<string, string> = {
    current: "Code actuel", new: "Nouveau code", confirm: "Confirmer", done: "Code mis à jour ✓"
  };
  const subtitles: Record<string, string> = {
    current: "Saisissez votre code PIN actuel", new: "Choisissez un nouveau code à 4 chiffres", confirm: "Confirmez le nouveau code", done: "Votre nouveau code PIN est enregistré"
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 32 }}>
        <div className="handle" style={{ alignSelf: "stretch" }} />
        <div style={{ fontSize: step === "done" ? 44 : 32, marginBottom: -8 }}>{step === "done" ? "✅" : "🔑"}</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{titles[step]}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 4 }}>{subtitles[step]}</div>
        </div>
        {step !== "done" && (
          <>
            <div style={{ display: "flex", gap: 16, animation: error ? "es 0.3s ease" : "none" }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", background: pin.length > i ? "#818cf8" : "transparent", borderColor: pin.length > i ? "#818cf8" : "rgba(255,255,255,.4)", transition: "all .2s" }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, width: "100%", maxWidth: 280 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
                <button key={i} className="pb" style={{ visibility: k === "" ? "hidden" : "visible", width: "100%", margin: "0 auto" }}
                  onClick={() => k === "⌫" ? setPin(p => p.slice(0, -1)) : handleDigit(String(k))}>{k}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [selectedCat, setSelectedCat] = useState("stocks");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NoteEntry>>({});

  const getItems = (cat: string): { id: number; name?: string; banque?: string }[] => {
    if (cat === "scpi") return data.scpi;
    if (cat === "immo") return data.immo;
    if (cat === "attente") return data.attente;
    if (cat === "epargne") return data.epargne as { id: number; name?: string; banque?: string }[];
    return (data as Record<string, unknown>)[cat] as { id: number; name?: string; banque?: string }[] || [];
  };

  const getNoteKey = (cat: string, id: number) => `${cat}_${id}`;
  const getNote = (cat: string, id: number): NoteEntry => data.notes[getNoteKey(cat, id)] || { courtier: "", contact: "", conditions: "", remarques: "" };

  const saveNote = (key: string, note: Partial<NoteEntry>) => {
    setData(p => ({ ...p, notes: { ...p.notes, [key]: note as NoteEntry } }));
    setEditingKey(null);
  };

  const catConfig = NOTE_CATEGORIES.find(c => c.key === selectedCat) || NOTE_CATEGORIES[0];
  const items = getItems(selectedCat);

  return (
    <div>
      <div style={{ overflowX: "auto", display: "flex", gap: 8, marginBottom: 14, paddingBottom: 4 }}>
        {NOTE_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setSelectedCat(cat.key)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: selectedCat === cat.key ? cat.color + "33" : "rgba(255,255,255,.06)", color: selectedCat === cat.key ? cat.color : "rgba(255,255,255,.5)", borderWidth: 1, borderStyle: "solid", borderColor: selectedCat === cat.key ? cat.color + "66" : "transparent" }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {items.length === 0 && <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", padding: "40px 0" }}>Aucun élément</div>}

      {items.map(item => {
        const key = getNoteKey(selectedCat, item.id);
        const note = getNote(selectedCat, item.id);
        const hasNote = !!(note.courtier || note.contact || note.conditions || note.remarques);
        const isEditing = editingKey === key;

        return (
          <div key={item.id} style={{ background: "rgba(255,255,255,.04)", borderRadius: 18, marginBottom: 10, border: `1px solid ${hasNote ? catConfig.color + "44" : "rgba(255,255,255,.07)"}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => { if (!isEditing) { setEditingKey(key); setEditForm(note); } }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: catConfig.color + "22", color: catConfig.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {(item.name || item.banque || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name || item.banque}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.38)" }}>{hasNote ? [note.courtier, note.contact].filter(Boolean).join(" · ") || "Notes disponibles" : "Appuyer pour ajouter une note"}</div>
                </div>
              </div>
              <div style={{ fontSize: 18, color: hasNote ? catConfig.color : "rgba(255,255,255,.25)" }}>{hasNote ? "📝" : "✏️"}</div>
            </div>

            {hasNote && !isEditing && (
              <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }} onClick={() => { setEditingKey(key); setEditForm(note); }}>
                {note.courtier && <div style={{ fontSize: 12 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Courtier: </span><span>{note.courtier}</span></div>}
                {note.contact && <div style={{ fontSize: 12 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Contact: </span><span>{note.contact}</span></div>}
                {note.conditions && <div style={{ fontSize: 12 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Conditions: </span><span>{note.conditions}</span></div>}
                {note.remarques && (
                  <div style={{ marginTop: 4, padding: "8px 12px", background: catConfig.color + "11", borderRadius: 10, borderLeft: `3px solid ${catConfig.color}` }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 3 }}>Remarques</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{note.remarques}</div>
                  </div>
                )}
              </div>
            )}

            {isEditing && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ height: 1, background: "rgba(255,255,255,.08)", marginBottom: 14 }} />
                {([
                  { key: "courtier", label: "🏛 Courtier / Plateforme", placeholder: "ex: Trade Republic, Optyma..." },
                  { key: "contact", label: "👤 Contact", placeholder: "ex: Jean Dupont, 06 12 34 56 78" },
                  { key: "conditions", label: "📋 Conditions particulières", placeholder: "ex: Frais d'entrée 2%, lock-up 3 ans..." },
                ] as { key: keyof NoteEntry; label: string; placeholder: string }[]).map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginBottom: 5 }}>{f.label}</div>
                    <input style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 12px", color: "#f1f5f9", fontSize: 14, width: "100%", fontFamily: "inherit" }} placeholder={f.placeholder} value={(editForm[f.key] as string) || ""} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginBottom: 5 }}>📌 Remarques libres</div>
                  <textarea rows={4} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 12px", color: "#f1f5f9", fontSize: 14, width: "100%", fontFamily: "inherit", resize: "none", lineHeight: 1.5 }} placeholder="Notes libres, rappels, contexte d'achat..." value={editForm.remarques || ""} onChange={e => setEditForm(p => ({ ...p, remarques: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveNote(key, editForm)} style={{ flex: 1, background: catConfig.color, color: "white", border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Enregistrer</button>
                  <button onClick={() => setEditingKey(null)} style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 16px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                </div>
                {hasNote && (
                  <button onClick={() => saveNote(key, { courtier: "", contact: "", conditions: "", remarques: "" })} style={{ width: "100%", background: "rgba(248,113,113,.1)", color: "#f87171", border: "none", borderRadius: 12, padding: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>Effacer les notes</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MobileDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pinCode, setPinCode] = useState<string>(loadPin);
  const [showChangePin, setShowChangePin] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(loadAutoLock);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [historyPeriod, setHistoryPeriod] = useState<number>(90);
  const [data, setData] = useState<AppData>(loadData);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [usdEur, setUsdEur] = useState(0.92);
  const [tab, setTab] = useState("home");
  const [immoSubTab, setImmoSubTab] = useState("biens");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [enfantTab, setEnfantTab] = useState("cesar");
  const [colorPicker, setColorPicker] = useState(BANK_COLORS[0]);

  const handleShake = useCallback(() => { if (authenticated) setLocked(p => !p); }, [authenticated]);
  useShake(handleShake);

  const H = (val: string) => locked ? "••••••" : val;
  const HP = (val: string) => locked ? "••••" : val;

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  // Save daily snapshot once prices finish loading
  useEffect(() => {
    if (!authenticated || loading || total === 0) return;
    setHistory(prev => upsertTodaySnapshot(prev, total));
  }, [loading, authenticated]);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!authenticated || locked || autoLockMinutes === 0) return;
    const ms = autoLockMinutes * 60 * 1000;
    let timer = setTimeout(() => setLocked(true), ms);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => setLocked(true), ms); };
    const events = ["touchstart", "touchmove", "mousedown", "mousemove", "keydown", "scroll", "click"];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    return () => { clearTimeout(timer); events.forEach(ev => window.removeEventListener(ev, reset)); };
  }, [authenticated, locked, autoLockMinutes]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const fxRes = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey=${ALPHA_VANTAGE_KEY}`);
      const fxData = await fxRes.json();
      const rate = fxData?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"];
      if (rate) setUsdEur(parseFloat(rate));
      const cryptoIds = data.crypto.map(c => c.coingeckoId).join(",");
      const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`);
      const cgData = await cgRes.json();
      const newPrices: Record<string, number> = {};
      data.crypto.forEach(c => { if (cgData[c.coingeckoId]) newPrices[c.ticker] = cgData[c.coingeckoId].usd; });
      const allStocks = [...new Set([...data.stocks.map(s => s.ticker), ...data.enfants.cesar.pea.map(s => s.ticker), ...data.enfants.juliette.pea.map(s => s.ticker)])];
      for (const ticker of allStocks) {
        const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`);
        const d = await res.json();
        const p = d["Global Quote"]?.["05. price"];
        if (p) newPrices[ticker] = parseFloat(p);
        await new Promise(r => setTimeout(r, 600));
      }
      setPrices(newPrices); setUpdated(new Date());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [data.crypto, data.stocks, data.enfants]);

  useEffect(() => { if (!authenticated) return; fetchAll(); const t = setInterval(fetchAll, 5 * 60 * 1000); return () => clearInterval(t); }, [authenticated]);

  const sp = (ticker: string, bp: number) => prices[ticker] || bp;
  const sv = data.stocks.reduce((a, s) => a + sp(s.ticker, s.buyPrice) * s.quantity * usdEur, 0);
  const sc = data.stocks.reduce((a, s) => a + s.buyPrice * s.quantity * usdEur, 0);
  const cv = data.crypto.reduce((a, c) => a + sp(c.ticker, c.buyPrice) * c.quantity * usdEur, 0);
  const cc = data.crypto.reduce((a, c) => a + c.buyPrice * c.quantity * usdEur, 0);
  const pev = data.pe.reduce((a, p) => a + p.amount * p.multiple, 0);
  const pec = data.pe.reduce((a, p) => a + p.amount, 0);
  const biensv = data.immo.reduce((a, i) => a + i.value, 0);
  const biensc = data.immo.reduce((a, i) => a + i.acquisition, 0);
  const scpiv = data.scpi.reduce((a, s) => a + s.prixPartActuel * s.nbParts, 0);
  const scpic = data.scpi.reduce((a, s) => a + s.prixAchatPart * s.nbParts, 0);
  const imv = biensv + scpiv; const imc = biensc + scpic;
  const attv = data.attente.filter(a => a.statut === "En cours").reduce((a, f) => a + f.amount, 0);
  const epv = data.epargne.reduce((a, e) => a + e.montant, 0);
  const cesarPEAv = data.enfants.cesar.pea.reduce((a, s) => a + sp(s.ticker, s.buyPrice) * s.quantity * usdEur, 0);
  const juliettePEAv = data.enfants.juliette.pea.reduce((a, s) => a + sp(s.ticker, s.buyPrice) * s.quantity * usdEur, 0);
  const cesarTotal = cesarPEAv + data.enfants.cesar.livret;
  const julietteTotal = juliettePEAv + data.enfants.juliette.livret;
  const total = sv + cv + pev + imv; const totalCost = sc + cc + pec + imc;
  const gain = total - totalCost; const gainPct = (gain / totalCost) * 100;

  const peChart = [{ y: 2026, v: 0 }, { y: 2027, v: 0 }, { y: 2028, v: 0 }, { y: 2029, v: 16000 }, { y: 2030, v: 56000 }, { y: 2031, v: 184000 }, { y: 2032, v: 283000 }, { y: 2033, v: 333000 }, { y: 2034, v: 381000 }];

  const totalNotes = Object.values(data.notes).filter(n => n.courtier || n.contact || n.conditions || n.remarques).length;

  const addItem = (type: string) => {
    const id = Date.now();
    if (type === "stocks") setData(p => ({ ...p, stocks: [...p.stocks, { id, type: "Action", name: String(form.name || ""), ticker: String(form.ticker || ""), quantity: +form.quantity, buyPrice: +form.buyPrice }] }));
    else if (type === "crypto") setData(p => ({ ...p, crypto: [...p.crypto, { id, coingeckoId: String(form.coingeckoId || form.ticker || "").toLowerCase(), name: String(form.name || ""), ticker: String(form.ticker || ""), quantity: +form.quantity, buyPrice: +form.buyPrice }] }));
    else if (type === "pe") setData(p => ({ ...p, pe: [...p.pe, { id, name: String(form.name || ""), amount: +form.amount, multiple: +form.multiple, end: +form.end }] }));
    else if (type === "bien") setData(p => ({ ...p, immo: [...p.immo, { id, type: "bien", name: String(form.name || ""), adresse: String(form.adresse || ""), ville: String(form.ville || ""), codePostal: String(form.codePostal || ""), surface: +form.surface, prixAchatM2: +form.prixAchatM2, value: +form.value, acquisition: +form.acquisition, rent: +form.rent, charges: +form.charges }] }));
    else if (type === "scpi") setData(p => ({ ...p, scpi: [...p.scpi, { id, name: String(form.name || ""), gestionnaire: String(form.gestionnaire || ""), type: String(form.type || ""), nbParts: +form.nbParts, prixAchatPart: +form.prixAchatPart, prixPartActuel: +form.prixPartActuel, rendementAnnuel: +form.rendementAnnuel }] }));
    else if (type === "attente") setData(p => ({ ...p, attente: [...p.attente, { id, statut: "En cours", name: String(form.name || ""), beneficiaire: String(form.beneficiaire || ""), amount: +form.amount, dateRetour: String(form.dateRetour || "") }] }));
    else if (type === "epargne") setData(p => ({ ...p, epargne: [...p.epargne, { id, couleur: colorPicker, banque: String(form.banque || ""), produit: String(form.produit || ""), montant: +form.montant }] }));
    else if (type === "cesar_pea") setData(p => ({ ...p, enfants: { ...p.enfants, cesar: { ...p.enfants.cesar, pea: [...p.enfants.cesar.pea, { id, type: "Action", name: String(form.name || ""), ticker: String(form.ticker || ""), quantity: +form.quantity, buyPrice: +form.buyPrice }] } } }));
    else if (type === "juliette_pea") setData(p => ({ ...p, enfants: { ...p.enfants, juliette: { ...p.enfants.juliette, pea: [...p.enfants.juliette.pea, { id, type: "Action", name: String(form.name || ""), ticker: String(form.ticker || ""), quantity: +form.quantity, buyPrice: +form.buyPrice }] } } }));
    else if (type === "cesar_livret") setData(p => ({ ...p, enfants: { ...p.enfants, cesar: { ...p.enfants.cesar, livret: +form.livret } } }));
    else if (type === "juliette_livret") setData(p => ({ ...p, enfants: { ...p.enfants, juliette: { ...p.enfants.juliette, livret: +form.livret } } }));
    setModal(null); setForm({}); setColorPicker(BANK_COLORS[0]);
  };

  const del = (type: string, id: number, enfant?: string) => {
    if (type === "stocks") setData(p => ({ ...p, stocks: p.stocks.filter(i => i.id !== id) }));
    else if (type === "crypto") setData(p => ({ ...p, crypto: p.crypto.filter(i => i.id !== id) }));
    else if (type === "pe") setData(p => ({ ...p, pe: p.pe.filter(i => i.id !== id) }));
    else if (type === "immo") setData(p => ({ ...p, immo: p.immo.filter(i => i.id !== id) }));
    else if (type === "scpi") setData(p => ({ ...p, scpi: p.scpi.filter(i => i.id !== id) }));
    else if (type === "attente") setData(p => ({ ...p, attente: p.attente.filter(i => i.id !== id) }));
    else if (type === "epargne") setData(p => ({ ...p, epargne: p.epargne.filter(i => i.id !== id) }));
    else if (type === "enfant_pea" && enfant) setData(p => ({ ...p, enfants: { ...p.enfants, [enfant]: { ...p.enfants[enfant as "cesar" | "juliette"], pea: p.enfants[enfant as "cesar" | "juliette"].pea.filter(i => i.id !== id) } } }));
  };

  const toggleStatut = (id: number) => setData(p => ({ ...p, attente: p.attente.map(a => a.id === id ? { ...a, statut: a.statut === "En cours" ? "Remboursé" : "En cours" } : a) }));
  const updateEpargne = (id: number, v: number) => setData(p => ({ ...p, epargne: p.epargne.map(e => e.id === id ? { ...e, montant: v } : e) }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && parsed.stocks && parsed.crypto) { if (!parsed.notes) parsed.notes = {}; setData(parsed); }
        else alert("Fichier JSON invalide.");
      } catch { alert("Impossible de lire ce fichier JSON."); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  if (!authenticated) return <LockScreen onUnlock={() => setAuthenticated(true)} pinCode={pinCode} />;
  if (locked) return <ShakeLockOverlay onUnlock={() => setLocked(false)} pinCode={pinCode} />;

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a14", fontFamily: "-apple-system,'SF Pro Display',sans-serif", color: "#f1f5f9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        .card{background:rgba(255,255,255,0.06);border-radius:20px;border:1px solid rgba(255,255,255,0.08);}
        .tap{transition:transform .12s,opacity .12s;cursor:pointer;}.tap:active{transform:scale(0.96);opacity:.75;}
        .pos{color:#34d399;}.neg{color:#f87171;}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);z-index:50;display:flex;align-items:flex-end;}
        .sheet{background:#131320;border-radius:24px 24px 0 0;width:100%;padding:24px 20px 36px;border-top:1px solid rgba(255,255,255,.1);max-height:92vh;overflow-y:auto;}
        .inp{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px;color:#f1f5f9;font-size:15px;width:100%;font-family:inherit;margin-bottom:10px;}
        .inp:focus{outline:none;border-color:#818cf8;background:rgba(129,140,248,.1);}
        .btn-main{background:#6366f1;color:white;border:none;border-radius:14px;padding:16px;width:100%;font-size:16px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:4px;}
        .btn-danger{background:rgba(248,113,113,.15);color:#f87171;border:none;border-radius:14px;padding:14px;width:100%;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:8px;}
        .nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(10,10,20,.97);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.07);display:flex;padding:10px 0 24px;z-index:40;overflow-x:auto;}
        .nav::-webkit-scrollbar{display:none;}
        .nav-item{flex:0 0 auto;min-width:50px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:2px 4px;position:relative;}
        .scroll-area{height:calc(100vh - 100px);overflow-y:auto;padding:12px 14px 110px;}
        .scroll-area::-webkit-scrollbar{display:none;}
        .row-item{display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,.04);border-radius:16px;margin-bottom:8px;cursor:pointer;}
        .row-item:active{background:rgba(255,255,255,.09);}
        .avatar{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;}
        .fab{position:fixed;bottom:88px;right:16px;width:52px;height:52px;background:#6366f1;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;box-shadow:0 8px 28px rgba(99,102,241,.45);z-index:35;}
        .fab:active{transform:scale(.9);}
        .pulse{animation:pu 2s infinite;}@keyframes pu{0%,100%{opacity:1}50%{opacity:.3}}
        .shimmer{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:sh 1.5s infinite;border-radius:8px;}
        @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .handle{width:38px;height:4px;background:rgba(255,255,255,.18);border-radius:2px;margin:0 auto 22px;}
        .subtab{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;border:none;font-family:inherit;}
        .detail-row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06);align-items:center;}
        .color-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:border-color .2s;flex-shrink:0;}
        .color-dot.selected{border-color:white;}
        .bank-bar{height:6px;border-radius:3px;transition:width .5s;}
        .tag{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-block;}
        .badge-note{position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:#f59e0b;border-radius:50%;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#0a0a14;}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>{updated ? `Màj ${updated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chargement..."}</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Grotesk'", letterSpacing: "-0.5px" }}>{TAB_ICONS[tab]} {TAB_LABELS[tab]}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="tap" onClick={() => setLocked(true)} style={{ width: 38, height: 38, background: "rgba(255,255,255,.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔒</div>
          <div className="tap" onClick={fetchAll} style={{ width: 38, height: 38, background: "rgba(255,255,255,.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {loading ? <span className="pulse">⟳</span> : "⟳"}
          </div>
        </div>
      </div>

      <div className="scroll-area">

        {/* HOME */}
        {tab === "home" && (
          <>
            <div className="card" style={{ padding: 22, marginBottom: 14, background: "linear-gradient(135deg,rgba(99,102,241,.22),rgba(129,140,248,.04))", border: "1px solid rgba(129,140,248,.25)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 6 }}>Portefeuille total</div>
              {loading ? <div className="shimmer" style={{ height: 46, width: "68%", marginBottom: 10 }} /> : (
                <div style={{ fontSize: 44, fontWeight: 700, fontFamily: "'Space Grotesk'", letterSpacing: "-1.5px", lineHeight: 1 }}>{H(fmt(total))}</div>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                {[{ l: "Investi", v: H(fmt(totalCost)) }, { l: "P&L", v: H(fmt(gain)), c: gain >= 0 ? "#34d399" : "#f87171" }, { l: "Perf.", v: HP(pct(gainPct)), c: gain >= 0 ? "#34d399" : "#f87171" }].map((x, i) => (
                  <div key={i}><div style={{ fontSize: 11, color: "rgba(255,255,255,.38)" }}>{x.l}</div><div style={{ fontSize: 15, fontWeight: 600, color: x.c || "#f1f5f9" }}>{x.v}</div></div>
                ))}
              </div>
            </div>

            {/* Net worth history chart */}
            {(() => {
              const PERIODS = [
                { label: "1M", days: 30 },
                { label: "3M", days: 90 },
                { label: "6M", days: 180 },
                { label: "1A", days: 365 },
                { label: "Tout", days: 99999 },
              ];
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - historyPeriod);
              const cutoffStr = historyPeriod >= 99999 ? "0000-00-00" : cutoff.toISOString().slice(0, 10);
              const visible = history.filter(e => e.date >= cutoffStr);
              const first = visible[0]?.total ?? 0;
              const last = visible[visible.length - 1]?.total ?? 0;
              const periodGain = last - first;
              const periodPct = first > 0 ? (periodGain / first) * 100 : 0;
              const isUp = periodGain >= 0;
              const chartColor = isUp ? "#34d399" : "#f87171";
              const fmtTick = (dateStr: string) => {
                const d = new Date(dateStr + "T00:00:00");
                return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
              };
              const tickCount = Math.min(visible.length, historyPeriod <= 30 ? 5 : 4);
              const tickIndices = visible.length <= tickCount
                ? visible.map((_, i) => i)
                : Array.from({ length: tickCount }, (_, i) => Math.round(i * (visible.length - 1) / (tickCount - 1)));
              const tickDates = new Set(tickIndices.map(i => visible[i]?.date).filter(Boolean));

              return (
                <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Évolution du patrimoine</div>
                      {visible.length >= 2 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: chartColor }}>{isUp ? "▲" : "▼"} {Math.abs(periodPct).toFixed(1)}%</span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>{H(isUp ? `+${fmt(periodGain)}` : fmt(periodGain))}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 3 }}>Les données s'accumulent chaque jour</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {PERIODS.map(p => (
                        <button key={p.days} onClick={() => setHistoryPeriod(p.days)}
                          style={{ padding: "4px 9px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, background: historyPeriod === p.days ? "rgba(129,140,248,.25)" : "rgba(255,255,255,.07)", color: historyPeriod === p.days ? "#818cf8" : "rgba(255,255,255,.4)", borderWidth: 1, borderStyle: "solid", borderColor: historyPeriod === p.days ? "rgba(129,140,248,.4)" : "transparent" }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visible.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={visible} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,.35)" }} axisLine={false} tickLine={false}
                          tickFormatter={fmtTick}
                          ticks={[...tickDates]}
                        />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Tooltip
                          formatter={(v: number) => [locked ? "••••••" : fmt(v), "Total"]}
                          labelFormatter={(l: string) => new Date(l + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                          contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 10, fontSize: 12 }}
                        />
                        <Area type="monotone" dataKey="total" stroke={chartColor} strokeWidth={2} fill="url(#hg)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.2)", fontSize: 12 }}>
                      📊 Le graphique apparaîtra après quelques jours d'utilisation
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Actions/ETF", value: sv, cost: sc, color: "#818cf8", icon: "📈", t: "actions" },
                { label: "Crypto", value: cv, cost: cc, color: "#34d399", icon: "₿", t: "crypto" },
                { label: "Private Equity", value: pev, cost: pec, color: "#fbbf24", icon: "🏦", t: "pe" },
                { label: "Immo + SCPI", value: imv, cost: imc, color: "#f87171", icon: "🏠", t: "immo" },
              ].map((item, i) => {
                const g = item.value - item.cost; const gp = (g / item.cost) * 100;
                return (
                  <div key={i} className="card tap" style={{ padding: 16 }} onClick={() => setTab(item.t)}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600 }} className={g >= 0 ? "pos" : "neg"}>{HP(pct(gp))}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{H(fmt(item.value))}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[
                { label: "Attente", value: attv, color: "#a78bfa", icon: "💤", t: "attente", showVal: true },
                { label: "Épargne", value: epv, color: "#38bdf8", icon: "🏧", t: "epargne", showVal: true },
                { label: "Enfants", value: cesarTotal + julietteTotal, color: "#38bdf8", icon: "👨‍👧‍👦", t: "enfants", showVal: true },
                { label: `Notes`, value: null, color: "#f59e0b", icon: "📝", t: "notes", showVal: false },
              ].map((item, i) => (
                <div key={i} className="card tap" style={{ padding: 12 }} onClick={() => setTab(item.t)}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginTop: 6, marginBottom: 2 }}>{item.label}</div>
                  {item.showVal && item.value !== null
                    ? <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{H(fmt(item.value))}</div>
                    : <div style={{ fontSize: 12, color: item.color, fontWeight: 600 }}>{totalNotes} note{totalNotes !== 1 ? "s" : ""}</div>}
                </div>
              ))}
            </div>

            {/* Export / Import */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <button onClick={exportData} style={{ flex: 1, background: "rgba(129,140,248,.12)", border: "1px solid rgba(129,140,248,.25)", color: "#818cf8", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>⬇ Exporter JSON</button>
              <label style={{ flex: 1, background: "rgba(52,211,153,.10)", border: "1px solid rgba(52,211,153,.22)", color: "#34d399", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ⬆ Importer JSON
                <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importData} />
              </label>
            </div>

            {/* Security settings */}
            <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", marginBottom: 10 }}>
              {/* Change PIN row */}
              <div onClick={() => setShowChangePin(true)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔑</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Code PIN</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>Modifier votre code d'accès</div>
                  </div>
                </div>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,.25)" }}>›</span>
              </div>

              {/* Auto-lock row */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>⏱</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Verrouillage auto</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>Verrouiller après inactivité</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {AUTO_LOCK_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setAutoLockMinutes(opt.value); localStorage.setItem(AUTO_LOCK_KEY, String(opt.value)); }}
                      style={{ padding: "7px 13px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: autoLockMinutes === opt.value ? "rgba(129,140,248,.25)" : "rgba(255,255,255,.07)", color: autoLockMinutes === opt.value ? "#818cf8" : "rgba(255,255,255,.45)", borderWidth: 1, borderStyle: "solid", borderColor: autoLockMinutes === opt.value ? "rgba(129,140,248,.5)" : "transparent", transition: "all .15s" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,.2)", marginTop: 2 }}>
              🔒 Secouez pour verrouiller · {loading ? "..." : `${usdEur.toFixed(4)}€/$`}
            </div>
          </>
        )}

        {/* ACTIONS */}
        {tab === "actions" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(135deg,rgba(99,102,241,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total Actions/ETF</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#818cf8" }}>{H(fmt(sv))}</div>
              <div style={{ fontSize: 13 }} className={(sv - sc) >= 0 ? "pos" : "neg"}>{HP(pct(((sv - sc) / sc) * 100))} · {H(fmt(sv - sc))}</div>
            </div>
            {data.stocks.map(s => {
              const cp = sp(s.ticker, s.buyPrice); const val = cp * s.quantity * usdEur; const cost = s.buyPrice * s.quantity * usdEur;
              const g = val - cost; const gp = (g / cost) * 100; const isLive = !!prices[s.ticker];
              const hasNote = !!(data.notes[`stocks_${s.id}`]?.courtier || data.notes[`stocks_${s.id}`]?.remarques);
              return (
                <div key={s.id} className="row-item" onClick={() => setDetail({ type: "stock", item: s, val, cost, g, gp, cp, isLive })}>
                  <div className="avatar" style={{ background: "rgba(129,140,248,.15)", color: "#818cf8", position: "relative" }}>
                    {s.ticker.slice(0, 2)}
                    {hasNote && <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, background: "#f59e0b", borderRadius: "50%", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0a14", fontWeight: 700 }}>📝</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{s.ticker} · {s.quantity} {isLive && <span style={{ color: "#34d399" }}>●</span>}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{H(fmt(val))}</div>
                    <div style={{ fontSize: 12 }} className={g >= 0 ? "pos" : "neg"}>{HP(pct(gp))}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* CRYPTO */}
        {tab === "crypto" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(135deg,rgba(52,211,153,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total Crypto</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#34d399" }}>{H(fmt(cv))}</div>
              <div style={{ fontSize: 13 }} className={(cv - cc) >= 0 ? "pos" : "neg"}>{HP(pct(((cv - cc) / cc) * 100))} · {H(fmt(cv - cc))}</div>
            </div>
            {data.crypto.map(c => {
              const cp = sp(c.ticker, c.buyPrice); const val = cp * c.quantity * usdEur; const cost = c.buyPrice * c.quantity * usdEur;
              const g = val - cost; const gp = (g / cost) * 100; const isLive = !!prices[c.ticker];
              return (
                <div key={c.id} className="row-item" onClick={() => setDetail({ type: "crypto", item: c, val, cost, g, gp, cp, isLive })}>
                  <div className="avatar" style={{ background: "rgba(52,211,153,.15)", color: "#34d399" }}>{c.ticker.slice(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{c.quantity} {c.ticker} {isLive && <span style={{ color: "#34d399" }}>●</span>}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{H(fmt(val))}</div>
                    <div style={{ fontSize: 12 }} className={g >= 0 ? "pos" : "neg"}>{HP(pct(gp))}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* PE */}
        {tab === "pe" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(135deg,rgba(251,191,36,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total Private Equity</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#fbbf24" }}>{H(fmt(pev))}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)" }}>Investi: {H(fmt(pec))}</div>
            </div>
            {data.pe.map(p => {
              const hasNote = !!(data.notes[`pe_${p.id}`]?.courtier || data.notes[`pe_${p.id}`]?.remarques);
              return (
                <div key={p.id} className="row-item" onClick={() => setDetail({ type: "pe", item: p })}>
                  <div className="avatar" style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24", position: "relative" }}>
                    PE
                    {hasNote && <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, background: "#f59e0b", borderRadius: "50%", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0a14", fontWeight: 700 }}>📝</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>Jusqu'en {p.end} · {p.multiple}x</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#fbbf24" }}>{H(fmt(p.amount * p.multiple))}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{H(fmt(p.amount))}</div>
                  </div>
                </div>
              );
            })}
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 10 }}>Distributions cumulées</div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={peChart}>
                  <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} /><stop offset="95%" stopColor="#fbbf24" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="y" tick={{ fontSize: 10, fill: "rgba(255,255,255,.4)" }} axisLine={false} tickLine={false} />
                  <YAxis hide /><Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "none", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="v" stroke="#fbbf24" strokeWidth={2} fill="url(#pg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* IMMO */}
        {tab === "immo" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 14, background: "linear-gradient(135deg,rgba(248,113,113,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total Immobilier</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#f87171" }}>{H(fmt(imv))}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div><div style={{ fontSize: 11, color: "rgba(255,255,255,.38)" }}>🏠 Biens</div><div style={{ fontSize: 15, fontWeight: 600 }}>{H(fmt(biensv))}</div></div>
                <div><div style={{ fontSize: 11, color: "rgba(255,255,255,.38)" }}>🏢 SCPI</div><div style={{ fontSize: 15, fontWeight: 600 }}>{H(fmt(scpiv))}</div></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, background: "rgba(255,255,255,.05)", borderRadius: 16, padding: 4 }}>
              {[{ key: "biens", label: "🏠 Biens physiques" }, { key: "scpi", label: "🏢 SCPI" }].map(s => (
                <button key={s.key} className="subtab" style={{ flex: 1, background: immoSubTab === s.key ? "#6366f1" : "transparent", color: immoSubTab === s.key ? "white" : "rgba(255,255,255,.5)", border: "none", fontFamily: "inherit" }} onClick={() => setImmoSubTab(s.key)}>{s.label}</button>
              ))}
            </div>
            {immoSubTab === "biens" && data.immo.map(bien => {
              const market = getMarket(bien.codePostal);
              const valeurMarche = market.prixM2 * bien.surface;
              const prixPctDiff = ((market.prixM2 - bien.prixAchatM2) / bien.prixAchatM2) * 100;
              const rn = (bien.rent - bien.charges) * 12;
              const yield_ = ((rn / bien.acquisition) * 100).toFixed(1);
              return (
                <div key={bien.id} className="card" style={{ padding: 16, marginBottom: 12, cursor: "pointer" }} onClick={() => setDetail({ type: "bien", item: bien, market, valeurMarche, prixPctDiff, rn, yield_ })}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div><div style={{ fontSize: 16, fontWeight: 700 }}>{bien.name}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>📍 {bien.adresse}, {bien.ville}</div></div>
                    <span className="tag" style={{ background: "rgba(248,113,113,.15)", color: "#f87171" }}>Physique</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[{ l: "Valeur", v: H(fmt(bien.value)), c: "#f87171" }, { l: "Plus-value", v: H(fmt(bien.value - bien.acquisition)), c: (bien.value - bien.acquisition) >= 0 ? "#34d399" : "#f87171" }, { l: "Surface", v: `${bien.surface} m²` }, { l: "Rendement", v: `${yield_}%`, c: "#fbbf24" }].map((k, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,.04)", borderRadius: 12, padding: 10 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>{k.l}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: k.c || "#f1f5f9" }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 14, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>📊 {market.ville}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: market.variation1an >= 0 ? "#34d399" : "#f87171" }}>{market.variation1an >= 0 ? "▲" : "▼"} {Math.abs(market.variation1an)}%/an</div>
                    </div>
                    <ResponsiveContainer width="100%" height={70}>
                      <AreaChart data={market.tendance.map((v, i) => ({ a: market.annees[i], v }))}>
                        <defs><linearGradient id={`mg${bien.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.3} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient></defs>
                        <XAxis dataKey="a" tick={{ fontSize: 9, fill: "rgba(255,255,255,.35)" }} axisLine={false} tickLine={false} />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Area type="monotone" dataKey="v" stroke="#f87171" strokeWidth={2} fill={`url(#mg${bien.id})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bien.adresse + " " + bien.ville)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 12px", background: "rgba(129,140,248,.1)", borderRadius: 10, textDecoration: "none", color: "#818cf8", fontSize: 12 }}>🗺️ Voir sur la carte</a>
                  </div>
                </div>
              );
            })}
            {immoSubTab === "scpi" && (
              <>
                <div className="card" style={{ padding: "14px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>Valeur SCPI</div><div style={{ fontSize: 22, fontWeight: 700, color: "#f87171" }}>{H(fmt(scpiv))}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>P&L</div><div style={{ fontSize: 16, fontWeight: 600 }} className={(scpiv - scpic) >= 0 ? "pos" : "neg"}>{H(fmt(scpiv - scpic))}</div></div>
                </div>
                {data.scpi.map(s => {
                  const val = s.prixPartActuel * s.nbParts; const cost = s.prixAchatPart * s.nbParts;
                  const g = val - cost; const gp = (g / cost) * 100; const revenuAnnuel = val * (s.rendementAnnuel / 100);
                  const history = SCPI_HISTORY[s.name] || [];
                  return (
                    <div key={s.id} className="card" style={{ padding: 16, marginBottom: 12, cursor: "pointer" }} onClick={() => setDetail({ type: "scpi", item: s, val, cost, g, gp, revenuAnnuel, history })}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div><div style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{s.gestionnaire}</div></div>
                        <span className="tag" style={{ background: "rgba(248,113,113,.1)", color: "#f87171" }}>{s.type}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        {[{ l: "Valeur nette", v: H(fmt(val)), c: g >= 0 ? "#34d399" : "#f87171" }, { l: "P&L", v: H(fmt(g)), c: g >= 0 ? "#34d399" : "#f87171" }, { l: "Rendement", v: `${s.rendementAnnuel}%`, c: "#fbbf24" }, { l: "Revenu/an", v: H(fmt(revenuAnnuel)), c: "#fbbf24" }].map((k, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,.04)", borderRadius: 12, padding: 10 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>{k.l}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: k.c || "#f1f5f9" }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      {history.length > 0 && (
                        <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 14, padding: 12 }}>
                          <ResponsiveContainer width="100%" height={70}>
                            <LineChart data={history}>
                              <XAxis dataKey="y" tick={{ fontSize: 9, fill: "rgba(255,255,255,.35)" }} axisLine={false} tickLine={false} />
                              <YAxis hide domain={["auto", "auto"]} />
                              <ReferenceLine y={s.prixAchatPart} stroke="rgba(255,255,255,.2)" strokeDasharray="3 3" />
                              <Line type="monotone" dataKey="v" stroke={g >= 0 ? "#34d399" : "#f87171"} strokeWidth={2} dot={{ fill: g >= 0 ? "#34d399" : "#f87171", r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ATTENTE */}
        {tab === "attente" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(135deg,rgba(167,139,250,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Fonds en attente</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#a78bfa" }}>{H(fmt(attv))}</div>
            </div>
            {data.attente.map(a => {
              const dl = daysLeft(a.dateRetour);
              return (
                <div key={a.id} className="row-item" onClick={() => setDetail({ type: "attente", item: a, dl })}>
                  <div className="avatar" style={{ background: a.statut === "Remboursé" ? "rgba(52,211,153,.15)" : "rgba(167,139,250,.15)", color: a.statut === "Remboursé" ? "#34d399" : "#a78bfa" }}>{a.statut === "Remboursé" ? "✓" : "💤"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{a.beneficiaire} · {fmtD(a.dateRetour)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: a.statut === "Remboursé" ? "#34d399" : "#a78bfa" }}>{H(fmt(a.amount))}</div>
                    <div style={{ fontSize: 11, color: a.statut === "Remboursé" ? "#34d399" : dl.color }}>{a.statut === "Remboursé" ? "✓ Remboursé" : dl.label}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ÉPARGNE */}
        {tab === "epargne" && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 14, background: "linear-gradient(135deg,rgba(56,189,248,.15),transparent)" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total épargne</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#38bdf8" }}>{H(fmt(epv))}</div>
            </div>
            {data.epargne.length > 0 && (
              <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                {data.epargne.map(e => (
                  <div key={e.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{e.banque}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: e.couleur }}>{((e.montant / epv) * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3 }}>
                      <div className="bank-bar" style={{ width: `${(e.montant / epv) * 100}%`, background: e.couleur }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.epargne.map(e => (
              <div key={e.id} className="row-item" onClick={() => setDetail({ type: "epargne", item: e })}>
                <div className="avatar" style={{ background: `${e.couleur}22`, color: e.couleur }}>🏛</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{e.banque}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{e.produit}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: e.couleur }}>{H(fmt(e.montant))}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{((e.montant / epv) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ENFANTS */}
        {tab === "enfants" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, background: "rgba(255,255,255,.05)", borderRadius: 16, padding: 4 }}>
              {["cesar", "juliette"].map(e => (
                <button key={e} className="subtab" style={{ flex: 1, background: enfantTab === e ? "#6366f1" : "transparent", color: enfantTab === e ? "white" : "rgba(255,255,255,.5)", border: "none", fontFamily: "inherit" }} onClick={() => setEnfantTab(e)}>
                  {e === "cesar" ? "👦 César" : "👧 Juliette"}
                </button>
              ))}
            </div>
            {(["cesar", "juliette"] as const).map(enfant => enfantTab === enfant && (
              <div key={enfant}>
                <div className="card" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(135deg,rgba(56,189,248,.15),transparent)" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>Total {enfant === "cesar" ? "César" : "Juliette"}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#38bdf8" }}>{H(fmt(enfant === "cesar" ? cesarTotal : julietteTotal))}</div>
                </div>
                <div className="card" style={{ padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)" }}>📗 Livret</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>{H(fmt(data.enfants[enfant].livret))}</div>
                  </div>
                  <button className="tap" style={{ background: "rgba(56,189,248,.15)", border: "1px solid rgba(56,189,248,.3)", color: "#38bdf8", borderRadius: 10, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }} onClick={() => { setModal(`${enfant}_livret`); setForm({ livret: data.enfants[enfant].livret }); }}>Modifier</button>
                </div>
                {data.enfants[enfant].pea.map(s => {
                  const cp = sp(s.ticker, s.buyPrice); const val = cp * s.quantity * usdEur; const cost = s.buyPrice * s.quantity * usdEur;
                  const g = val - cost; const gp = (g / cost) * 100;
                  return (
                    <div key={s.id} className="row-item" onClick={() => setDetail({ type: "enfant_stock", item: s, val, cost, g, gp, cp, enfant })}>
                      <div className="avatar" style={{ background: "rgba(56,189,248,.15)", color: "#38bdf8" }}>{s.ticker.slice(0, 2)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{s.ticker} · {s.quantity} titres</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{H(fmt(val))}</div>
                        <div style={{ fontSize: 12 }} className={g >= 0 ? "pos" : "neg"}>{HP(pct(gp))}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {/* NOTES */}
        {tab === "notes" && <NotesTab data={data} setData={setData} />}

      </div>

      {/* FAB */}
      {tab !== "home" && tab !== "notes" && (
        <div className="fab" onClick={() => {
          if (tab === "actions") setModal("stocks");
          else if (tab === "crypto") setModal("crypto");
          else if (tab === "pe") setModal("pe");
          else if (tab === "immo") setModal(immoSubTab === "biens" ? "bien" : "scpi");
          else if (tab === "attente") setModal("attente");
          else if (tab === "epargne") setModal("epargne");
          else if (tab === "enfants") setModal(`${enfantTab}_pea`);
          setForm({}); setColorPicker(BANK_COLORS[0]);
        }}>+</div>
      )}

      {/* Bottom Nav */}
      <div className="nav">
        {TABS.map(t => (
          <div key={t} className="nav-item tap" onClick={() => setTab(t)}>
            <div style={{ fontSize: 16, opacity: tab === t ? 1 : 0.38 }}>{TAB_ICONS[t]}</div>
            {t === "notes" && totalNotes > 0 && <span className="badge-note">{totalNotes}</span>}
            <div style={{ fontSize: 9, fontWeight: tab === t ? 700 : 400, color: tab === t ? "#818cf8" : "rgba(255,255,255,.35)" }}>{TAB_LABELS[t]}</div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="handle" />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
              {modal === "bien" ? "🏠 Bien" : modal === "scpi" ? "🏢 SCPI" : modal === "stocks" ? "➕ Action/ETF" : modal === "crypto" ? "➕ Crypto" : modal === "pe" ? "➕ Fonds PE" : modal === "attente" ? "➕ Fonds en attente" : modal === "epargne" ? "🏧 Compte" : modal.includes("pea") ? "➕ Action PEA" : "💰 Livret"}
            </div>
            {modal === "bien" && <><input className="inp" placeholder="Nom" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Adresse" onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))} /><input className="inp" placeholder="Ville" onChange={e => setForm(p => ({ ...p, ville: e.target.value }))} /><input className="inp" placeholder="Code postal" onChange={e => setForm(p => ({ ...p, codePostal: e.target.value }))} /><input className="inp" placeholder="Surface (m²)" type="number" onChange={e => setForm(p => ({ ...p, surface: e.target.value }))} /><input className="inp" placeholder="Prix achat/m²" type="number" onChange={e => setForm(p => ({ ...p, prixAchatM2: e.target.value }))} /><input className="inp" placeholder="Prix acquisition (€)" type="number" onChange={e => setForm(p => ({ ...p, acquisition: e.target.value }))} /><input className="inp" placeholder="Valeur actuelle (€)" type="number" onChange={e => setForm(p => ({ ...p, value: e.target.value }))} /><input className="inp" placeholder="Loyer/mois (€)" type="number" onChange={e => setForm(p => ({ ...p, rent: e.target.value }))} /><input className="inp" placeholder="Charges/mois (€)" type="number" onChange={e => setForm(p => ({ ...p, charges: e.target.value }))} /></>}
            {modal === "scpi" && <><input className="inp" placeholder="Nom de la SCPI" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Gestionnaire" onChange={e => setForm(p => ({ ...p, gestionnaire: e.target.value }))} /><input className="inp" placeholder="Type (Bureaux, Diversifié...)" onChange={e => setForm(p => ({ ...p, type: e.target.value }))} /><input className="inp" placeholder="Nombre de parts" type="number" onChange={e => setForm(p => ({ ...p, nbParts: e.target.value }))} /><input className="inp" placeholder="Prix achat/part (€)" type="number" onChange={e => setForm(p => ({ ...p, prixAchatPart: e.target.value }))} /><input className="inp" placeholder="Prix actuel/part (€)" type="number" onChange={e => setForm(p => ({ ...p, prixPartActuel: e.target.value }))} /><input className="inp" placeholder="Rendement (%)" type="number" step="0.01" onChange={e => setForm(p => ({ ...p, rendementAnnuel: e.target.value }))} /></>}
            {(modal === "stocks" || modal === "cesar_pea" || modal === "juliette_pea") && <><input className="inp" placeholder="Nom" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Ticker" onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} /><input className="inp" placeholder="Prix d'achat" type="number" onChange={e => setForm(p => ({ ...p, buyPrice: e.target.value }))} /><input className="inp" placeholder="Quantité" type="number" onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></>}
            {modal === "crypto" && <><input className="inp" placeholder="Nom" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Ticker (ex: SOL)" onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} /><input className="inp" placeholder="CoinGecko ID (ex: solana)" onChange={e => setForm(p => ({ ...p, coingeckoId: e.target.value.toLowerCase() }))} /><input className="inp" placeholder="Prix d'achat ($)" type="number" onChange={e => setForm(p => ({ ...p, buyPrice: e.target.value }))} /><input className="inp" placeholder="Quantité" type="number" onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></>}
            {modal === "pe" && <><input className="inp" placeholder="Nom du fonds" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Montant investi (€)" type="number" onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /><input className="inp" placeholder="Multiple projeté (ex: 2.1)" type="number" step="0.01" onChange={e => setForm(p => ({ ...p, multiple: e.target.value }))} /><input className="inp" placeholder="Année de fin" type="number" onChange={e => setForm(p => ({ ...p, end: e.target.value }))} /></>}
            {modal === "attente" && <><input className="inp" placeholder="Libellé" onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /><input className="inp" placeholder="Bénéficiaire" onChange={e => setForm(p => ({ ...p, beneficiaire: e.target.value }))} /><input className="inp" placeholder="Montant (€)" type="number" onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /><input className="inp" placeholder="Date retour (AAAA-MM-JJ)" onChange={e => setForm(p => ({ ...p, dateRetour: e.target.value }))} /></>}
            {modal === "epargne" && <><input className="inp" placeholder="Banque" onChange={e => setForm(p => ({ ...p, banque: e.target.value }))} /><input className="inp" placeholder="Produit" onChange={e => setForm(p => ({ ...p, produit: e.target.value }))} /><input className="inp" placeholder="Montant (€)" type="number" onChange={e => setForm(p => ({ ...p, montant: e.target.value }))} /><div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 10 }}>Couleur</div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{BANK_COLORS.map(c => <div key={c} className={`color-dot ${colorPicker === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColorPicker(c)} />)}</div></div></>}
            {(modal === "cesar_livret" || modal === "juliette_livret") && (<input className="inp" placeholder="Solde (€)" type="number" defaultValue={form.livret} onChange={e => setForm(p => ({ ...p, livret: e.target.value }))} />)}
            <button className="btn-main" onClick={() => addItem(modal)}>Enregistrer</button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="handle" />
            {(detail.type === "stock" || detail.type === "enfant_stock") && (() => {
              const item = detail.item as typeof data.stocks[0];
              return <>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>{item.ticker} {!!detail.isLive && <span style={{ color: "#34d399" }}>● Live</span>}</div>
                {[{ l: "Valeur", v: H(fmt(detail.val as number)), c: "#818cf8" }, { l: "Coût", v: H(fmt(detail.cost as number)) }, { l: "P&L", v: `${H(fmt(detail.g as number))} (${HP(pct(detail.gp as number))})`, c: (detail.g as number) >= 0 ? "#34d399" : "#f87171" }, { l: "Prix achat", v: `${item.buyPrice}` }, { l: "Prix actuel", v: `${(detail.cp as number)?.toFixed(2)}` }, { l: "Quantité", v: `${item.quantity} titres` }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <button onClick={() => { setTab("notes"); setDetail(null); }} style={{ width: "100%", background: "rgba(245,158,11,.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, padding: 12, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>📝 Voir / Ajouter une note</button>
                <button className="btn-danger" onClick={() => { detail.type === "enfant_stock" ? del("enfant_pea", item.id, detail.enfant as string) : del("stocks", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "crypto" && (() => {
              const item = detail.item as typeof data.crypto[0];
              return <>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>{item.ticker} {!!detail.isLive && <span style={{ color: "#34d399" }}>● Live</span>}</div>
                {[{ l: "Valeur", v: H(fmt(detail.val as number)), c: "#34d399" }, { l: "Coût", v: H(fmt(detail.cost as number)) }, { l: "P&L", v: `${H(fmt(detail.g as number))} (${HP(pct(detail.gp as number))})`, c: (detail.g as number) >= 0 ? "#34d399" : "#f87171" }, { l: "Quantité", v: `${item.quantity} ${item.ticker}` }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <button className="btn-danger" onClick={() => { del("crypto", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "pe" && (() => {
              const item = detail.item as typeof data.pe[0];
              return <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>Jusqu'en {item.end}</div>
                {[{ l: "Valeur projetée", v: H(fmt(item.amount * item.multiple)), c: "#fbbf24" }, { l: "Investi", v: H(fmt(item.amount)) }, { l: "Multiple", v: `${item.multiple}x` }, { l: "Gain projeté", v: H(fmt(item.amount * (item.multiple - 1))), c: "#34d399" }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <button onClick={() => { setTab("notes"); setDetail(null); }} style={{ width: "100%", background: "rgba(245,158,11,.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, padding: 12, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>📝 Voir / Ajouter une note</button>
                <button className="btn-danger" onClick={() => { del("pe", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "bien" && (() => {
              const item = detail.item as typeof data.immo[0];
              return <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 16 }}>📍 {item.adresse}, {item.ville}</div>
                {[{ l: "Valeur", v: H(fmt(item.value)), c: "#f87171" }, { l: "Acquisition", v: H(fmt(item.acquisition)) }, { l: "Plus-value", v: H(fmt(item.value - item.acquisition)), c: (item.value - item.acquisition) >= 0 ? "#34d399" : "#f87171" }, { l: "Rendement", v: `${detail.yield_}%`, c: "#fbbf24" }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.adresse + " " + item.ville)}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 12, padding: 12, background: "rgba(129,140,248,.15)", borderRadius: 12, color: "#818cf8", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>🗺️ Google Maps</a>
                <button className="btn-danger" onClick={() => { del("immo", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "scpi" && (() => {
              const item = detail.item as typeof data.scpi[0];
              return <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 16 }}>{item.gestionnaire}</div>
                {[{ l: "Valeur nette", v: H(fmt(detail.val as number)), c: (detail.g as number) >= 0 ? "#34d399" : "#f87171" }, { l: "Coût", v: H(fmt(detail.cost as number)) }, { l: "P&L", v: `${H(fmt(detail.g as number))} (${HP(pct(detail.gp as number))})`, c: (detail.g as number) >= 0 ? "#34d399" : "#f87171" }, { l: "Rendement", v: `${item.rendementAnnuel}%`, c: "#fbbf24" }, { l: "Revenu annuel", v: H(fmt(detail.revenuAnnuel as number)), c: "#fbbf24" }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <button className="btn-danger" onClick={() => { del("scpi", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "attente" && (() => {
              const item = detail.item as typeof data.attente[0];
              const dl = detail.dl as ReturnType<typeof daysLeft>;
              return <>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>Fonds en attente</div>
                {[{ l: "Montant", v: H(fmt(item.amount)), c: "#a78bfa" }, { l: "Bénéficiaire", v: item.beneficiaire }, { l: "Date retour", v: fmtD(item.dateRetour) }, { l: "Délai", v: dl.label, c: dl.color }, { l: "Statut", v: item.statut, c: item.statut === "Remboursé" ? "#34d399" : "#a78bfa" }].map((row, i) => (
                  <div key={i} className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{row.l}</span><span style={{ fontSize: 14, fontWeight: 600, color: row.c || "#f1f5f9" }}>{row.v}</span></div>
                ))}
                <button className="btn-main" style={{ marginTop: 16, background: item.statut === "En cours" ? "rgba(52,211,153,.2)" : "rgba(167,139,250,.2)", color: item.statut === "En cours" ? "#34d399" : "#a78bfa" }} onClick={() => { toggleStatut(item.id); setDetail(null); }}>
                  {item.statut === "En cours" ? "✓ Marquer remboursé" : "↩ Remettre en attente"}
                </button>
                <button className="btn-danger" onClick={() => { del("attente", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
            {detail.type === "epargne" && (() => {
              const item = detail.item as typeof data.epargne[0];
              return <>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{item.banque}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>{item.produit}</div>
                <div className="detail-row"><span style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>Montant</span><span style={{ fontSize: 20, fontWeight: 700, color: item.couleur }}>{H(fmt(item.montant))}</span></div>
                <input className="inp" style={{ marginTop: 16 }} placeholder="Nouveau montant (€)" type="number" defaultValue={item.montant} onChange={e => setForm({ montant: +e.target.value })} />
                <button className="btn-main" onClick={() => { if (form.montant) updateEpargne(item.id, form.montant as number); setDetail(null); setForm({}); }}>Mettre à jour</button>
                <button className="btn-danger" onClick={() => { del("epargne", item.id); setDetail(null); }}>Supprimer</button>
              </>;
            })()}
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePin && (
        <ChangePinModal
          currentPin={pinCode}
          onSave={np => setPinCode(np)}
          onClose={() => setShowChangePin(false)}
        />
      )}
    </div>
  );
}
