import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API = window.location.hostname === "localhost" 
  ? "http://localhost:8000/api" 
  : "https://shakai.up.railway.app/api"
const CONTRACT_TYPES = ["CDI", "CDD", "Stage", "Alternance", "Freelance", "Interim", "Temps partiel"]

function App() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [cvFile, setCvFile] = useState(null)
  const [cvData, setCvData] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [offers, setOffers] = useState([])
  const [suggestedOffers, setSuggestedOffers] = useState([])
  const [generatingLetter, setGeneratingLetter] = useState(null)
  const [location, setLocation] = useState("Paris")
  const [selectedContracts, setSelectedContracts] = useState([])
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false)
  const [prioritizedMetiers, setPrioritizedMetiers] = useState([])
  const [sortByDate, setSortByDate] = useState(false)
  const [selectedMetier, setSelectedMetier] = useState("")
  const contractDropdownRef = useRef(null)
  
  useEffect(() => {
  const handleClickOutside = (event) => {
    if (contractDropdownRef.current && !contractDropdownRef.current.contains(event.target)) {
      setContractDropdownOpen(false)
    }
  }
  document.addEventListener("mousedown", handleClickOutside)
  return () => document.removeEventListener("mousedown", handleClickOutside)
}, [])
  const toggleContract = (contract) => {
  setSelectedContracts(prev =>
    prev.includes(contract) ? [] : [contract]
  )
}

  const analyzeCV = async () => {
    if (!cvFile) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", cvFile)
      const res = await axios.post(`${API}/analyze-cv`, formData)
      setCvData(res.data.cv_data)
      setAnalysis(res.data.analysis)
      setPrioritizedMetiers(res.data.analysis.metiers_suggeres.map(m => ({ ...m, active: true })))
      setStep(2)
    } catch (err) {
      alert("Erreur lors de l'analyse du CV")
    }
    setLoading(false)
  }

  const searchOffers = async () => {
    setScraping(true)
    setSelectedMetier("")
    try {
      const activeMetiers = prioritizedMetiers.filter(m => m.active !== false)
      const formData = new FormData()
      formData.append("file", cvFile)
      formData.append("location", location === "partout" ? "" : location)
      formData.append("max_results", 50)
      formData.append("contract_types", selectedContracts.join(","))
      formData.append("prioritized_metiers", JSON.stringify(activeMetiers.map(m => m.titre)))
      const res = await axios.post(`${API}/analyze-and-search`, formData)
      setCvData(res.data.cv_data)
      setOffers(res.data.offers || [])
      setSuggestedOffers(res.data.suggested_offers || [])
      setStep(3)
    } catch (err) {
      alert("Erreur lors de la recherche des offres")
    }
    setScraping(false)
  }

  const generateLetter = async (offer) => {
    setGeneratingLetter(offer.url)
    try {
      const res = await axios.post(
        `${API}/generate-letter`,
        { cv_data: cvData, job_offer: offer, tone: "professionnel", export_pdf: true },
        { responseType: "blob" }
      )
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement("a")
      link.href = blobUrl
      link.setAttribute("download", "lettre.pdf")
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      alert("Erreur lors de la génération de la lettre")
    }
    setGeneratingLetter(null)
  }

  const moveMetier = (index, direction) => {
    const newList = [...prioritizedMetiers]
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= newList.length) return
    const temp = newList[index]
    newList[index] = newList[newIndex]
    newList[newIndex] = temp
    setPrioritizedMetiers(newList)
  }

  const toggleMetierActive = (index) => {
    const newList = [...prioritizedMetiers]
    newList[index] = { ...newList[index], active: !newList[index].active }
    setPrioritizedMetiers(newList)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const lower = dateStr.toLowerCase()
    const minutesMatch = lower.match(/(\d+)\s*(minute|minutes|min)/)
    if (minutesMatch) return `Il y a ${minutesMatch[1]} minute${minutesMatch[1] > 1 ? "s" : ""}`
    const hoursMatch = lower.match(/(\d+)\s*(heure|heures|hour|hours|hr)/)
    if (hoursMatch) return `Il y a ${hoursMatch[1]} heure${hoursMatch[1] > 1 ? "s" : ""}`
    const daysMatch = lower.match(/(\d+)\s*(jour|jours|day|days)/)
    if (daysMatch) return `Il y a ${daysMatch[1]} jour${daysMatch[1] > 1 ? "s" : ""}`
    const weeksMatch = lower.match(/(\d+)\s*(semaine|semaines|week|weeks)/)
    if (weeksMatch) return `Il y a ${weeksMatch[1]} semaine${weeksMatch[1] > 1 ? "s" : ""}`
    const monthsMatch = lower.match(/(\d+)\s*(mois|month|months)/)
    if (monthsMatch) return `Il y a ${monthsMatch[1]} mois`
    if (lower.includes("aujourd") || lower.includes("today") || lower.includes("just")) return "Aujourd'hui"
    if (lower.includes("hier") || lower.includes("yesterday")) return "Hier"
    return dateStr
  }

  const parseDateForSort = (dateStr) => {
    if (!dateStr) return 9999
    const lower = dateStr.toLowerCase()
    const minutesMatch = lower.match(/(\d+)\s*(minute|minutes|min)/)
    if (minutesMatch) return parseInt(minutesMatch[1]) / 1440
    const hoursMatch = lower.match(/(\d+)\s*(heure|heures|hour|hours|hr)/)
    if (hoursMatch) return parseInt(hoursMatch[1]) / 24
    const daysMatch = lower.match(/(\d+)\s*(jour|jours|day|days)/)
    if (daysMatch) return parseInt(daysMatch[1])
    const weeksMatch = lower.match(/(\d+)\s*(semaine|semaines|week|weeks)/)
    if (weeksMatch) return parseInt(weeksMatch[1]) * 7
    const monthsMatch = lower.match(/(\d+)\s*(mois|month|months)/)
    if (monthsMatch) return parseInt(monthsMatch[1]) * 30
    return 9999
  }

  const uniqueMetiers = [...new Set(offers.map(o => o.metier_suggere).filter(Boolean))]

  const sortedOffers = sortByDate
    ? [...offers].sort((a, b) => parseDateForSort(a.date) - parseDateForSort(b.date))
    : offers

  const sortedSuggested = sortByDate
    ? [...suggestedOffers].sort((a, b) => parseDateForSort(a.date) - parseDateForSort(b.date))
    : suggestedOffers

  const filteredOffers = selectedMetier
    ? sortedOffers.filter(o => o.metier_suggere === selectedMetier)
    : sortedOffers

  const filteredSuggested = selectedMetier
    ? sortedSuggested.filter(o => o.metier_suggere === selectedMetier)
    : sortedSuggested

  const s = {
    page: { minHeight: "100vh", background: "#faf9f0", fontFamily: "sans-serif" },
    header: { background: "#052e16", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", padding: "16px 0" },
    headerInner: { maxWidth: 900, margin: "0 auto", padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    main: { maxWidth: 900, margin: "0 auto", padding: step === 1 ? "0" : "32px 16px" },
    card: { background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 32, border: "1px solid #dcfce7" },
    cardSmall: { background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, border: "1px solid #dcfce7" },
    btn: (disabled) => ({ background: disabled ? "#9ca3af" : "#ca8a04", color: disabled ? "white" : "#052e16", border: "none", borderRadius: 8, padding: "10px 32px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14 }),
    btnSmall: (disabled) => ({ fontSize: 13, background: disabled ? "#9ca3af" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", cursor: disabled ? "not-allowed" : "pointer" }),
    input: { width: "100%", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box", background: "white" },
    badge: (bg, color) => ({ background: bg, color: color, padding: "4px 12px", borderRadius: 999, fontSize: 13 }),
    offerCard: { border: "1px solid #dcfce7", borderRadius: 12, padding: 16, marginBottom: 12, background: "white" },
    row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
    link: { fontSize: 13, color: "#16a34a", textDecoration: "none", padding: "6px 12px", border: "1px solid #86efac", borderRadius: 8 }
  }

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setStep(1)}>
      <svg width="36" height="36" viewBox="0 0 80 80">
        <rect width="80" height="80" rx="18" fill="#16a34a"/>
        <circle cx="40" cy="40" r="33" fill="none" stroke="white" strokeWidth="1" opacity="0.15"/>
        <circle cx="40" cy="40" r="24" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
        <circle cx="40" cy="40" r="14" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"/>
        <path d="M22 26 Q22 13 40 13 Q58 13 58 26 Q58 36 40 36 Q22 36 22 50 Q22 63 40 63 Q58 63 58 50" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polygon points="50,43 63,47 50,51" fill="white"/>
      </svg>
      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, color: "white", letterSpacing: "-0.5px" }}>Shakai</span>
    </div>
  )

  const OfferCard = ({ offer, suggested }) => (
    <div style={{ ...s.offerCard, borderColor: suggested ? "#d1fae5" : "#dcfce7" }}>
      <div style={s.row}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 700, margin: "0 0 2px", fontSize: 15, color: "#052e16" }}>{offer.title}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#16a34a" }}>{offer.company}</p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#4b7a5a" }}>{offer.location}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={s.badge(suggested ? "#d1fae5" : "#dcfce7", suggested ? "#065f46" : "#166534")}>
              {offer.score_matching}% {suggested ? "profil" : "match"}
            </span>
            <span style={s.badge("#f0fdf4", "#4b7a5a")}>{offer.source}</span>
            <span style={s.badge("#fef9c3", "#854d0e")}>{offer.contract}</span>
            {offer.date && formatDate(offer.date) && (
              <span style={s.badge("#fef9c3", "#92400e")}>{formatDate(offer.date)}</span>
            )}
            {offer.metier_suggere && (
              <span style={s.badge("#f0fdf4", "#166534")}>{offer.metier_suggere}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
          <a href={offer.url} target="_blank" rel="noreferrer" style={s.link}>Voir l'offre</a>
          <button onClick={() => generateLetter(offer)} disabled={generatingLetter === offer.url} style={s.btnSmall(generatingLetter === offer.url)}>
            {generatingLetter === offer.url ? "Génération..." : "Générer la lettre"}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <Logo />
          <div style={{ display: "flex", gap: 8 }}>
            {["Upload CV", "Prioriser", "Offres"].map((label, i) => (
              <span key={i} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 13, background: step >= i + 1 ? "#ca8a04" : "#0f3d1f", color: step >= i + 1 ? "#052e16" : "#86efac", fontWeight: step >= i + 1 ? 700 : 400 }}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main style={{ ...s.main, pointerEvents: (scraping || loading) ? "none" : "auto" }}>

        {step === 1 && (
          <div>
            <div style={{ background: "#052e16", padding: "48px 32px", textAlign: "center", borderRadius: 24, margin: "32px auto", maxWidth: 640 }}>
              <div style={{ display: "inline-block", background: "#0f3d1f", border: "1px solid #166534", borderRadius: 999, padding: "6px 16px", fontSize: 12, color: "#86efac", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 20 }}>
                La recherche d'emploi n'a jamais été aussi simple grâce à Shakai !
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 42, color: "white", margin: "0 0 14px", letterSpacing: "-1px", lineHeight: 1.1 }}>
                Trouve ton Job idéal
              </h1>
              <p style={{ fontSize: 17, color: "#86efac", margin: "0 0 6px" }}>
                Dépose ton CV et laisse l'IA analyser ton profil
              </p>
              <p style={{ fontSize: 14, color: "#4ade80", margin: "0 0 40px", opacity: 0.8 }}>
                Offres personnalisées · Lettre de motivation générée automatiquement
              </p>

              <div style={{ maxWidth: 480, margin: "0 auto" }}>
                <div
  onClick={() => document.getElementById("cvInput").click()}
  onDragOver={(e) => e.preventDefault()}
  onDragEnter={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#4ade80"; e.currentTarget.style.background = "#0f3d1f" }}
  onDragLeave={(e) => { e.currentTarget.style.borderColor = cvFile ? "#16a34a" : "#166534"; e.currentTarget.style.background = cvFile ? "#0a3a1a" : "#0a2a12" }}
  onDrop={(e) => {
    e.preventDefault()
    e.currentTarget.style.borderColor = "#16a34a"
    e.currentTarget.style.background = "#0a3a1a"
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
      setCvFile(file)
    } else {
      alert("Format accepté : PDF ou DOCX uniquement")
    }
  }}
  style={{ border: `2px dashed ${cvFile ? "#16a34a" : "#166534"}`, borderRadius: 14, padding: "40px 24px", background: cvFile ? "#0a3a1a" : "#0a2a12", cursor: "pointer", marginBottom: 20, transition: "all 0.2s" }}
>
                  <input id="cvInput" type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={(e) => setCvFile(e.target.files[0])} />
                  {cvFile ? (
                    <div>
                      <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                      <p style={{ color: "#4ade80", fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>{cvFile.name}</p>
                      <p style={{ color: "#86efac", fontSize: 13, margin: 0, opacity: 0.7 }}>Clique pour changer de fichier</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 40, marginBottom: 12 }}>📄</p>
                      <p style={{ color: "white", fontWeight: 600, fontSize: 16, margin: "0 0 6px" }}>Clique ou glisse ton CV ici</p>
                      <p style={{ color: "#86efac", fontSize: 13, margin: 0, opacity: 0.7 }}>Formats acceptés : PDF ou DOCX</p>
                    </div>
                  )}
                </div>

                <button onClick={analyzeCV} disabled={!cvFile || loading} style={{ ...s.btn(!cvFile || loading), width: "100%", padding: "14px 32px", fontSize: 16, borderRadius: 10 }}>
                  {loading ? "Analyse en cours..." : "Analyser mon CV et trouver mes offres"}
                </button>

                {loading && (
  <div style={{ marginTop: 16, padding: 24, background: "#052e16", borderRadius: 12, border: "1px solid #166534", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
    <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-12px); opacity: 1; } }`}</style>
    <div style={{ display: "flex", gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: "50%", background: "#16a34a",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
    <p style={{ color: "#86efac", fontSize: 14, margin: 0 }}>Analyse de ton CV en cours...</p>
    <p style={{ color: "#4ade80", fontSize: 12, margin: 0, opacity: 0.7 }}>L'IA analyse ton profil — 10 à 20 secondes...</p>
  </div>
)}
              </div>
            </div>

            <div style={{ background: "#faf9f0", padding: "32px 32px", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 32, paddingBottom: 24, borderBottom: "1px solid #dcfce7", marginBottom: 24 }}>
                {[
                  { icon: "🎯", label: "Analyse IA", desc: "Ton profil décrypté" },
                  { icon: "🔍", label: "Scraping live", desc: "Offres en temps réel" },
                  { icon: "✉️", label: "Lettre de motivation auto", desc: "Personnalisée par offre" },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#052e16" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#166534" }}>{item.desc}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Offres analysées", value: "En temps réel" },
                  { label: " Sites d'offres scrapés", value: "Indeed, Welcome to the Jungle, Linkedin... " },
                  { label: "Lettres générées", value: "Par GPT-4o" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "white", border: "1px solid #dcfce7", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#16a34a" }}>{item.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4b7a5a" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && analysis && (
          <div>
            <div style={{ ...s.cardSmall, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#052e16" }}>Ton profil</h2>
              <p style={{ color: "#14532d", marginBottom: 12 }}>{analysis.profil_summary}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={s.badge("#dcfce7", "#166534")}>Niveau : {analysis.niveau}</span>
                {analysis.secteurs?.map((sec, i) => (
                  <span key={i} style={s.badge("#fef9c3", "#854d0e")}>{sec}</span>
                ))}
              </div>
            </div>

            <div style={{ ...s.cardSmall, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#052e16" }}>Priorise tes métiers</h2>
                  {JSON.stringify(prioritizedMetiers.map(m => m.titre)) !== JSON.stringify(analysis.metiers_suggeres.map(m => m.titre)) ? (
                    <span style={{ background: "#fef9c3", color: "#854d0e", fontSize: 12, padding: "2px 8px", borderRadius: 999, fontWeight: 500 }}>Priorisé</span>
                  ) : (
                    <span style={{ background: "#f0fdf4", color: "#166534", fontSize: 12, padding: "2px 8px", borderRadius: 999 }}>Aucune priorité</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setPrioritizedMetiers(analysis.metiers_suggeres.map(m => ({ ...m, active: true })))} style={{ fontSize: 12, color: "#4b7a5a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Réinitialiser</button>
                  <button onClick={() => setPrioritizedMetiers(prev => prev.map(m => ({ ...m, active: true })))} style={{ fontSize: 12, color: "#166534", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Tout activer</button>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #dcfce7" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#052e16", marginBottom: 8 }}>Affine ta recherche avec des mots-clés <span style={{ color: "#4b7a5a", fontWeight: 400 }}>(optionnel)</span></p>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            type="text"
            value={customMetier}
            onChange={e => setCustomMetier(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && customMetier.trim()) {
                setPrioritizedMetiers(prev => [...prev, { titre: customMetier.trim(), raison: "Ajouté manuellement", score_matching: 80, active: true }])
                setCustomMetier("")
              }
            }}
            placeholder="Job, Entreprise, Poste..."
            style={s.input}
          />
          <button
            onClick={() => {
              if (customMetier.trim()) {
                setPrioritizedMetiers(prev => [...prev, { titre: customMetier.trim(), raison: "Ajouté manuellement", score_matching: 80, active: true }])
                setCustomMetier("")
              }
            }}
            style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
          >
            + Ajouter
          </button>
        </div>
        {prioritizedMetiers.filter(m => m.raison === "Ajouté manuellement").length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {prioritizedMetiers.filter(m => m.raison === "Ajouté manuellement").map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 999, padding: "4px 12px", fontSize: 13, color: "#166534" }}>
                {m.titre}
                <button onClick={() => setPrioritizedMetiers(prev => prev.filter(p => p.titre !== m.titre))} style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
                </div>
              </div>
              <p style={{ color: "#4b7a5a", fontSize: 13, marginBottom: 20 }}>
                Utilise les flèches pour trier par ordre de priorité. Décoche les métiers qui ne t'intéressent pas.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prioritizedMetiers.map((metier, index) => (
                  <div key={index} style={{ border: `1px solid ${metier.active === false ? "#f3f4f6" : "#dcfce7"}`, borderRadius: 12, padding: "12px 16px", background: metier.active === false ? "#f9fafb" : "white", display: "flex", alignItems: "center", gap: 12, opacity: metier.active === false ? 0.5 : 1 }}>
                    <span style={{ fontSize: 16, color: "#86efac", fontWeight: "bold", minWidth: 24, textAlign: "center" }}>
                      {metier.active === false ? "-" : index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#052e16" }}>{metier.titre}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#4b7a5a" }}>{metier.raison}</p>
                    </div>
                    <span style={s.badge("#dcfce7", "#166534")}>{metier.score_matching}%</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button onClick={() => moveMetier(index, -1)} disabled={index === 0} style={{ background: "none", border: "1px solid #dcfce7", borderRadius: 4, padding: "2px 6px", cursor: index === 0 ? "not-allowed" : "pointer", color: index === 0 ? "#d1d5db" : "#166534", fontSize: 12 }}>▲</button>
                      <button onClick={() => moveMetier(index, 1)} disabled={index === prioritizedMetiers.length - 1} style={{ background: "none", border: "1px solid #dcfce7", borderRadius: 4, padding: "2px 6px", cursor: index === prioritizedMetiers.length - 1 ? "not-allowed" : "pointer", color: index === prioritizedMetiers.length - 1 ? "#d1d5db" : "#166534", fontSize: 12 }}>▼</button>
                    </div>
                    <input type="checkbox" checked={metier.active !== false} onChange={() => toggleMetierActive(index)} style={{ accentColor: "#16a34a" }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={s.cardSmall}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#052e16" }}>Critères de recherche</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#052e16" }}>Ville de recherche</label>
                  <input type="text" value={location === "partout" ? "" : location} onChange={e => setLocation(e.target.value)} style={{ ...s.input, opacity: location === "partout" ? 0.4 : 1 }} placeholder="Paris" disabled={location === "partout"} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer", fontSize: 13, color: "#4b7a5a" }}>
                    <input type="checkbox" checked={location === "partout"} onChange={e => setLocation(e.target.checked ? "partout" : "Paris")} style={{ accentColor: "#16a34a" }} />
                    N'importe où en France
                  </label>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#052e16" }}>
                    Type de contrat
                    {selectedContracts.length > 0 && (
                      <span style={{ marginLeft: 6, background: "#16a34a", color: "white", borderRadius: 999, fontSize: 11, padding: "1px 6px" }}>{selectedContracts.length}</span>
                    )}
                  </label>
                  <div style={{ position: "relative" }} ref={contractDropdownRef}>
                    <button onClick={() => setContractDropdownOpen(!contractDropdownOpen)} style={{ width: "100%", textAlign: "left", background: "white", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: selectedContracts.length > 0 ? "#052e16" : "#9ca3af" }}>
                        {selectedContracts.length > 0 ? selectedContracts.join(", ") : "Tous les contrats"}
                      </span>
                      <span style={{ fontSize: 10 }}>{contractDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {contractDropdownOpen && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #dcfce7", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 100, padding: 8 }}>
                        {CONTRACT_TYPES.map((contract) => (
                          <label key={contract} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderRadius: 6, background: selectedContracts.includes(contract) ? "#f0fdf4" : "white" }}>
                            <input type="radio" checked={selectedContracts.includes(contract)} onChange={() => toggleContract(contract)} style={{ accentColor: "#16a34a" }} />
                            <span style={{ fontSize: 13, color: "#052e16" }}>{contract}</span>
                          </label>
                        ))}
                        {selectedContracts.length > 0 && (
                          <button onClick={() => setSelectedContracts([])} style={{ width: "100%", marginTop: 4, padding: "6px 12px", fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", borderTop: "1px solid #f0fdf4" }}>
                            Effacer les filtres
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={searchOffers} disabled={scraping || prioritizedMetiers.filter(m => m.active !== false).length === 0} style={{ ...s.btn(scraping || prioritizedMetiers.filter(m => m.active !== false).length === 0), width: "100%" }}>
                {scraping ? "Recherche en cours..." : "Rechercher les offres"}
              </button>
              {scraping && (
  <div style={{ marginTop: 16, padding: 24, background: "#052e16", borderRadius: 12, border: "1px solid #166534", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
    <div style={{ display: "flex", gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: "50%", background: "#16a34a",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
    <p style={{ color: "#86efac", fontSize: 14, margin: 0 }}>Recherche des offres en cours...</p>
    <p style={{ color: "#4ade80", fontSize: 12, margin: 0, opacity: 0.7 }}>Analyse de ton profil sur Indeed, LinkedIn, WTTJ — 2 à 3 minutes</p>
    <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-12px); opacity: 1; } }`}</style>
  </div>
)}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ ...s.cardSmall, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#052e16" }}>
                    Offres trouvées ({filteredOffers.length}{selectedMetier ? ` / ${offers.length}` : ""})
                  </h2>
                  <p style={{ color: "#4b7a5a", fontSize: 13, margin: "4px 0 0" }}>Basées sur tes métiers prioritaires</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={selectedMetier} onChange={e => setSelectedMetier(e.target.value)} style={{ fontSize: 13, border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", background: selectedMetier ? "#f0fdf4" : "white", color: selectedMetier ? "#166534" : "#052e16" }}>
                    <option value="">Tous les métiers</option>
                    {uniqueMetiers.map((m, i) => (
                      <option key={i} value={m}>{m}</option>
                    ))}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "#052e16", background: sortByDate ? "#f0fdf4" : "#faf9f0", border: "1px solid #dcfce7", borderRadius: 8, padding: "6px 12px" }}>
                    <input type="checkbox" checked={sortByDate} onChange={e => setSortByDate(e.target.checked)} style={{ accentColor: "#16a34a" }} />
                    Trier par date
                  </label>
                  <button onClick={() => setStep(2)} style={{ fontSize: 13, color: "#166534", background: "none", border: "1px solid #86efac", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                    Modifier les priorités
                  </button>
                  <button onClick={() => setStep(1)} style={{ fontSize: 13, color: "#4b7a5a", background: "none", border: "none", cursor: "pointer" }}>
                    Nouveau CV
                  </button>
                </div>
              </div>
            </div>

            <div style={s.cardSmall}>
              {filteredOffers.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
                  <p>Aucune offre trouvée pour ces critères</p>
                  <button onClick={() => { setSelectedMetier(""); setStep(2) }} style={{ marginTop: 8, color: "#16a34a", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                    Modifier les critères
                  </button>
                </div>
              ) : (
                filteredOffers.map((offer, index) => (
                  <OfferCard key={index} offer={offer} suggested={false} />
                ))
              )}
            </div>

            {filteredSuggested.length > 0 && (
              <div style={{ ...s.cardSmall, marginTop: 24, borderTop: "3px solid #86efac" }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "#166534" }}>
                  Autres offres qui pourraient t'intéresser
                </h2>
                <p style={{ color: "#4b7a5a", fontSize: 13, marginBottom: 16 }}>
                  Ces offres ne correspondent pas exactement à tes critères mais sont pertinentes pour ton profil.
                </p>
                {filteredSuggested.map((offer, index) => (
                  <OfferCard key={index} offer={offer} suggested={true} />
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}

export default App