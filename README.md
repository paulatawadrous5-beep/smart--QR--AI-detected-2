README.md
# Smart QR — Context-Aware Adaptive QR Platform

> **"Paste a URL. Smart QR understands it and designs the QR around it."**

Smart QR shifts QR generation from manual color picking to automatic semantic design. It inspects destinations (platforms, personas, content types, and brand identities) and composes an aesthetically matched, scan-safe QR code.

---

## 🚀 Key Architectural Highlights

1. **Layered Detection Engine**
   - **Layer 1 (Known Platforms):** Deterministic extraction for Wikipedia, GitHub, LinkedIn, Instagram, YouTube, etc.
   - **Layer 2 (Path & Semantic Heuristics):** Analyzes slugs, profiles, handles, menus, or articles.
   - **Layer 3 (CORS-Safe Fallback):** Non-blocking metadata and favicon resolution that never breaks in pure client-side setups or GitHub Pages.

2. **Smart Design Engine (Context-Aware)**
   - Smart Design is not a preset mapping; it dynamically selects dot styles (Rounded, Dots, Classy Diamond, Smooth Flow), eye shapes, palettes, and framing based on context.
   - **Shuffle Variation:** Produces alternate, brand-consistent variations for the same destination.

3. **Scanability & Auto-Repair**
   - Live WCAG contrast telemetry.
   - Enforces finder quiet zones and logo area limits (≤ 25%).
   - Automatic palette correction if contrast drops below scanning thresholds.

4. **12 Ready-Made Presets**
   - Minimal, Professional, Corporate, Social Pop, Creator, Editorial, Dining Menu, Cyber Tech, Eco Organic, Neon Glow, Luxury Gold, and Playful.

5. **Independent UI Dark Mode**
   - Choose between Light, Dark, or System. UI appearance is cleanly decoupled from QR color choices.

---

## 🛠 Local Setup & Deployment

1. Unzip the project folder.
2. Open `index.html` directly in any web browser (no build steps, Node, or backend required).
3. **GitHub Pages Deployment:** Push the repository contents to GitHub and enable GitHub Pages on branch `main` root `/`.
