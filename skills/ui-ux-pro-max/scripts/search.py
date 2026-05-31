#!/usr/bin/env python3
"""UI/UX Pro Max search script — searches design system data by domain or keyword."""

import argparse
import json
import sys
import os

SKILLS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(SKILLS_DIR, "data")

# ── Inline data ──────────────────────────────────────────────────────────────

STYLES = [
    {"name": "Glassmorphism", "keywords": ["glass", "blur", "frosted", "transparent", "modern"], "description": "Frosted glass effect with backdrop blur, translucent surfaces, and subtle borders.", "prompt": "glassmorphism UI, frosted glass panels, backdrop blur, translucent white surfaces, thin white borders, soft shadows"},
    {"name": "Claymorphism", "keywords": ["clay", "3d", "soft", "playful", "puffy"], "description": "Soft, puffy 3D shapes with pastel colors and inner shadows.", "prompt": "claymorphism, soft inflated 3D shapes, pastel colors, inner glow shadow, rounded corners"},
    {"name": "Minimalism", "keywords": ["minimal", "clean", "simple", "whitespace", "flat"], "description": "Clean layouts with ample whitespace, limited palette, and clear hierarchy.", "prompt": "minimalist UI, lots of whitespace, clean typography, neutral colors, simple icons"},
    {"name": "Brutalism", "keywords": ["brutal", "raw", "bold", "strong", "contrast"], "description": "Raw, bold design with high contrast, thick borders, and unconventional layouts.", "prompt": "brutalist UI, raw black borders, high contrast, bold typography, stark layout"},
    {"name": "Neumorphism", "keywords": ["neumorphism", "soft", "extruded", "shadow", "depth"], "description": "Soft UI with extruded elements using dual shadows on same-color background.", "prompt": "neumorphism, soft extruded elements, dual shadows, monochromatic palette"},
    {"name": "Bento Grid", "keywords": ["bento", "grid", "cards", "mosaic", "tiles"], "description": "Asymmetric card grid inspired by Japanese bento boxes.", "prompt": "bento grid layout, asymmetric cards, mosaic tiles, varying card sizes"},
    {"name": "Dark Mode", "keywords": ["dark", "night", "black", "dim", "moody"], "description": "Dark backgrounds with light text, reduced glare, and vibrant accent colors.", "prompt": "dark mode UI, dark gray surfaces, high contrast text, neon/vibrant accents"},
    {"name": "Skeuomorphism", "keywords": ["skeuomorphic", "realistic", "texture", "material", "physical"], "description": "Designs that mimic real-world materials and textures.", "prompt": "skeuomorphic design, realistic textures, material surfaces, physical appearance"},
    {"name": "Flat Design", "keywords": ["flat", "2d", "simple", "icon", "color"], "description": "Two-dimensional design without shadows or depth effects.", "prompt": "flat design, 2D elements, solid colors, no shadows, simple icons"},
    {"name": "Aurora / Gradient", "keywords": ["aurora", "gradient", "glow", "colorful", "vibrant"], "description": "Vivid gradient backgrounds with aurora-like color blends.", "prompt": "aurora gradient background, vivid color transitions, glowing accents, soft color blends"},
]

COLOR_PALETTES = [
    {"name": "Ocean Blue", "industry": ["saas", "fintech", "tech", "productivity"], "light": ["#EFF6FF", "#DBEAFE", "#3B82F6", "#1D4ED8", "#1E3A5F"], "dark": ["#0F172A", "#1E293B", "#3B82F6", "#60A5FA", "#E2E8F0"]},
    {"name": "Forest Green", "industry": ["health", "wellness", "environment", "finance"], "light": ["#F0FDF4", "#DCFCE7", "#22C55E", "#15803D", "#14532D"], "dark": ["#052E16", "#14532D", "#22C55E", "#4ADE80", "#F0FDF4"]},
    {"name": "Sunset Rose", "industry": ["beauty", "fashion", "lifestyle", "social"], "light": ["#FFF1F2", "#FFE4E6", "#F43F5E", "#BE123C", "#881337"], "dark": ["#1C0813", "#4C0519", "#F43F5E", "#FB7185", "#FFE4E6"]},
    {"name": "Royal Purple", "industry": ["creative", "entertainment", "music", "gaming"], "light": ["#FAF5FF", "#F3E8FF", "#A855F7", "#7E22CE", "#581C87"], "dark": ["#1A0533", "#3B0764", "#A855F7", "#C084FC", "#F3E8FF"]},
    {"name": "Warm Amber", "industry": ["food", "hospitality", "retail", "ecommerce"], "light": ["#FFFBEB", "#FEF3C7", "#F59E0B", "#D97706", "#92400E"], "dark": ["#1C1006", "#451A03", "#F59E0B", "#FCD34D", "#FEF3C7"]},
    {"name": "Slate Neutral", "industry": ["corporate", "professional", "admin", "dashboard"], "light": ["#F8FAFC", "#F1F5F9", "#64748B", "#334155", "#0F172A"], "dark": ["#0F172A", "#1E293B", "#475569", "#94A3B8", "#F1F5F9"]},
    {"name": "Coral Energy", "industry": ["fitness", "sport", "energy", "motivation"], "light": ["#FFF7ED", "#FFEDD5", "#F97316", "#C2410C", "#7C2D12"], "dark": ["#1C0A03", "#431407", "#F97316", "#FB923C", "#FFEDD5"]},
    {"name": "Teal Modern", "industry": ["health", "medical", "tech", "startup"], "light": ["#F0FDFA", "#CCFBF1", "#14B8A6", "#0F766E", "#134E4A"], "dark": ["#022020", "#134E4A", "#14B8A6", "#2DD4BF", "#CCFBF1"]},
]

FONT_PAIRINGS = [
    {"heading": "Inter", "body": "Inter", "style": "modern minimal", "keywords": ["modern", "clean", "tech", "saas"], "weights": "700/400"},
    {"heading": "Playfair Display", "body": "Source Sans Pro", "style": "elegant editorial", "keywords": ["elegant", "luxury", "editorial", "beauty"], "weights": "700/400"},
    {"heading": "Space Grotesk", "body": "DM Sans", "style": "contemporary tech", "keywords": ["tech", "startup", "bold", "modern"], "weights": "600/400"},
    {"heading": "Fraunces", "body": "Nunito", "style": "playful warm", "keywords": ["playful", "friendly", "food", "lifestyle"], "weights": "700/400"},
    {"heading": "Syne", "body": "Epilogue", "style": "creative bold", "keywords": ["creative", "design", "art", "agency"], "weights": "800/400"},
    {"heading": "Merriweather", "body": "Open Sans", "style": "readable trustworthy", "keywords": ["blog", "news", "content", "readable"], "weights": "700/400"},
    {"heading": "Raleway", "body": "Lato", "style": "clean professional", "keywords": ["corporate", "professional", "clean"], "weights": "600/400"},
    {"heading": "Clash Display", "body": "Cabinet Grotesk", "style": "brutalist editorial", "keywords": ["brutal", "editorial", "bold", "strong"], "weights": "700/400"},
]

PRODUCTS = [
    {"type": "SaaS Dashboard", "keywords": ["saas", "dashboard", "admin", "analytics", "b2b"], "style": "Minimalism or Flat Design", "palette": "Slate Neutral or Ocean Blue", "font": "Inter/Inter or Space Grotesk/DM Sans"},
    {"type": "E-commerce", "keywords": ["ecommerce", "shop", "store", "retail", "product"], "style": "Minimalism or Flat Design", "palette": "Warm Amber or Slate Neutral", "font": "Playfair Display/Source Sans Pro"},
    {"type": "Landing Page", "keywords": ["landing", "marketing", "conversion", "cta", "hero"], "style": "Glassmorphism or Aurora Gradient", "palette": "Ocean Blue or Royal Purple", "font": "Space Grotesk/DM Sans"},
    {"type": "Beauty / Wellness", "keywords": ["beauty", "spa", "wellness", "cosmetic", "skincare"], "style": "Minimalism or Claymorphism", "palette": "Sunset Rose or Teal Modern", "font": "Playfair Display/Source Sans Pro"},
    {"type": "Fitness / Sport", "keywords": ["fitness", "sport", "gym", "health", "workout"], "style": "Dark Mode or Brutalism", "palette": "Coral Energy or Forest Green", "font": "Syne/Epilogue or Space Grotesk/DM Sans"},
    {"type": "Creative / Agency", "keywords": ["creative", "agency", "portfolio", "design", "studio"], "style": "Bento Grid or Brutalism", "palette": "Royal Purple or Coral Energy", "font": "Syne/Epilogue or Clash Display/Cabinet Grotesk"},
    {"type": "Food / Restaurant", "keywords": ["food", "restaurant", "delivery", "recipe", "cafe"], "style": "Claymorphism or Skeuomorphism", "palette": "Warm Amber", "font": "Fraunces/Nunito"},
    {"type": "Fintech", "keywords": ["fintech", "finance", "banking", "crypto", "investment"], "style": "Minimalism or Dark Mode", "palette": "Ocean Blue or Forest Green", "font": "Inter/Inter or Raleway/Lato"},
    {"type": "Mobile App", "keywords": ["mobile", "app", "ios", "android", "react native"], "style": "Glassmorphism or Minimalism", "palette": "Ocean Blue or Royal Purple", "font": "Inter/Inter"},
]

UX_RULES = {
    "accessibility": [
        "color-contrast: Minimum 4.5:1 ratio for normal text (large text 3:1)",
        "focus-states: Visible focus rings on interactive elements (2–4px)",
        "alt-text: Descriptive alt text for meaningful images",
        "aria-labels: aria-label for icon-only buttons",
        "keyboard-nav: Tab order matches visual order; full keyboard support",
        "reduced-motion: Respect prefers-reduced-motion",
    ],
    "touch": [
        "touch-target-size: Min 44×44pt (Apple) / 48×48dp (Material)",
        "touch-spacing: Minimum 8px gap between touch targets",
        "hover-vs-tap: Don't rely on hover alone for primary interactions",
        "loading-buttons: Disable button during async operations; show spinner",
        "tap-delay: Use touch-action: manipulation to reduce 300ms delay",
    ],
    "performance": [
        "image-optimization: Use WebP/AVIF, responsive images, lazy load",
        "image-dimension: Declare width/height to prevent layout shift (CLS)",
        "font-loading: Use font-display: swap to avoid invisible text",
        "lazy-loading: Lazy load non-hero components",
        "virtualize-lists: Virtualize lists with 50+ items",
    ],
    "animation": [
        "duration-timing: 150–300ms for micro-interactions; ≤400ms for complex",
        "transform-performance: Use transform/opacity only; never width/height",
        "easing: ease-out for entering, ease-in for exiting",
        "motion-meaning: Every animation must express cause-effect, not decoration",
        "spring-physics: Prefer spring/physics-based curves for natural feel",
        "exit-faster-than-enter: Exit animations ~60–70% of enter duration",
    ],
    "forms": [
        "input-labels: Visible label per input (not placeholder-only)",
        "error-placement: Show error below the related field",
        "submit-feedback: Loading then success/error state on submit",
        "inline-validation: Validate on blur, not keystroke",
        "input-type-keyboard: Use semantic input types (email, tel, number)",
        "progressive-disclosure: Reveal complex options progressively",
    ],
    "navigation": [
        "bottom-nav-limit: Bottom navigation max 5 items; use labels with icons",
        "back-behavior: Back navigation must be predictable and consistent",
        "deep-linking: All key screens reachable via deep link / URL",
        "nav-state-active: Current location must be visually highlighted",
        "modal-escape: Modals must offer a clear close/dismiss affordance",
    ],
    "layout": [
        "viewport-meta: width=device-width initial-scale=1 (never disable zoom)",
        "mobile-first: Design mobile-first, then scale up",
        "breakpoint-consistency: Use 375 / 768 / 1024 / 1440",
        "spacing-scale: Use 4pt/8dp incremental spacing system",
        "horizontal-scroll: No horizontal scroll on mobile",
    ],
}

CHARTS = [
    {"type": "Line Chart", "use_for": "Trends over time, continuous data", "keywords": ["trend", "time", "series", "growth", "over time"]},
    {"type": "Bar Chart", "use_for": "Comparing discrete categories", "keywords": ["compare", "comparison", "category", "ranking", "bar"]},
    {"type": "Pie / Donut", "use_for": "Proportions (max 5 categories)", "keywords": ["proportion", "share", "percentage", "pie", "donut"]},
    {"type": "Area Chart", "use_for": "Cumulative trends, stacked values", "keywords": ["area", "cumulative", "stacked", "volume"]},
    {"type": "Scatter Plot", "use_for": "Correlation between two variables", "keywords": ["scatter", "correlation", "distribution", "relationship"]},
    {"type": "Funnel", "use_for": "Conversion flows and drop-offs", "keywords": ["funnel", "conversion", "drop-off", "flow", "sales pipeline"]},
    {"type": "Heatmap", "use_for": "Density and intensity across a grid", "keywords": ["heatmap", "density", "intensity", "usage", "activity"]},
    {"type": "Gauge / Radial", "use_for": "Single KPI or progress indicator", "keywords": ["gauge", "kpi", "progress", "score", "meter"]},
]

# ── Search helpers ─────────────────────────────────────────────────────────────

def score(item_keywords, query_tokens):
    return sum(1 for t in query_tokens if any(t in kw.lower() for kw in item_keywords))

def search_styles(tokens, n):
    ranked = sorted(STYLES, key=lambda s: score(s["keywords"], tokens), reverse=True)
    return ranked[:n]

def search_colors(tokens, n):
    ranked = sorted(COLOR_PALETTES, key=lambda c: score(c["industry"], tokens), reverse=True)
    return ranked[:n]

def search_fonts(tokens, n):
    ranked = sorted(FONT_PAIRINGS, key=lambda f: score(f["keywords"], tokens), reverse=True)
    return ranked[:n]

def search_products(tokens, n):
    ranked = sorted(PRODUCTS, key=lambda p: score(p["keywords"], tokens), reverse=True)
    return ranked[:n]

def search_ux(tokens, n):
    results = []
    for category, rules in UX_RULES.items():
        for rule in rules:
            if any(t in rule.lower() for t in tokens):
                results.append(f"[{category}] {rule}")
    if not results:
        # return all if no match
        for category, rules in UX_RULES.items():
            for rule in rules[:2]:
                results.append(f"[{category}] {rule}")
    return results[:n]

def search_charts(tokens, n):
    ranked = sorted(CHARTS, key=lambda c: score(c["keywords"], tokens), reverse=True)
    return ranked[:n]

# ── Output formatters ──────────────────────────────────────────────────────────

def box(title, lines, width=70):
    print("┌" + "─" * (width - 2) + "┐")
    print("│ " + title.upper().ljust(width - 3) + "│")
    print("├" + "─" * (width - 2) + "┤")
    for line in lines:
        for chunk in [line[i:i+width-4] for i in range(0, max(len(line),1), width-4)]:
            print("│ " + chunk.ljust(width - 3) + "│")
    print("└" + "─" * (width - 2) + "┘")

def fmt_palette(p):
    swatches = " ".join(p["light"])
    return [f"  Name    : {p['name']}", f"  Industry: {', '.join(p['industry'])}", f"  Light   : {swatches}"]

def fmt_font(f):
    return [f"  Heading : {f['heading']}  Body: {f['body']}", f"  Style   : {f['style']}  Weights: {f['weights']}"]

# ── Design system ──────────────────────────────────────────────────────────────

def design_system(query, project, fmt):
    tokens = query.lower().split()
    style = search_styles(tokens, 1)[0]
    palette = search_colors(tokens, 2)
    font = search_fonts(tokens, 2)
    product = search_products(tokens, 1)[0]

    if fmt == "markdown":
        print(f"# Design System — {project or 'Project'}\n")
        print(f"## Product Pattern\n- **Type**: {product['type']}\n- **Recommended Style**: {product['style']}\n")
        print(f"## Style\n- **{style['name']}**: {style['description']}\n- **AI Prompt keywords**: `{style['prompt']}`\n")
        print(f"## Color Palettes")
        for p in palette:
            print(f"### {p['name']}\n- Light: {' / '.join(p['light'])}\n- Dark:  {' / '.join(p['dark'])}\n")
        print(f"## Typography")
        for f in font:
            print(f"- **{f['heading']}** (heading) + **{f['body']}** (body) — {f['style']}\n")
        print(f"## Anti-Patterns to Avoid\n- No emoji as icons (use SVG)\n- No placeholder-only form labels\n- No horizontal scroll on mobile\n- No animation on width/height — use transform/opacity\n")
    else:
        box(f"Product Pattern — {project or query}", [
            f"Type    : {product['type']}",
            f"Style   : {product['style']}",
            f"Palette : {product['palette']}",
            f"Font    : {product['font']}",
        ])
        box(f"Style — {style['name']}", [style['description'], "", "Prompt: " + style['prompt']])
        for p in palette:
            box(f"Color — {p['name']}", fmt_palette(p))
        for f in font:
            box(f"Font — {f['heading']} / {f['body']}", fmt_font(f))
        box("Anti-Patterns", [
            "✗ No emoji as icons — use SVG (Heroicons, Lucide)",
            "✗ No placeholder-only labels on form inputs",
            "✗ No horizontal scroll on mobile",
            "✗ Never animate width/height — use transform/opacity",
            "✗ No color as the only indicator (add icon/text)",
        ])

# ── Domain search ──────────────────────────────────────────────────────────────

def domain_search(query, domain, n, fmt):
    tokens = query.lower().split()
    domain = domain.lower()

    if domain == "style":
        results = search_styles(tokens, n)
        for r in results:
            box(f"Style — {r['name']}", [r['description'], "", "Prompt keywords: " + r['prompt']])

    elif domain in ("color", "colour"):
        results = search_colors(tokens, n)
        for r in results:
            box(f"Palette — {r['name']}", fmt_palette(r))

    elif domain in ("typography", "font"):
        results = search_fonts(tokens, n)
        for r in results:
            box(f"Font Pairing", fmt_font(r))

    elif domain == "product":
        results = search_products(tokens, n)
        for r in results:
            box(f"Product — {r['type']}", [
                f"Style   : {r['style']}",
                f"Palette : {r['palette']}",
                f"Font    : {r['font']}",
            ])

    elif domain == "ux":
        results = search_ux(tokens, n)
        box("UX Guidelines", results)

    elif domain == "chart":
        results = search_charts(tokens, n)
        for r in results:
            box(f"Chart — {r['type']}", [f"Use for : {r['use_for']}"])

    elif domain == "react":
        box("React / Next.js Best Practices", [
            "Use React.memo for expensive pure components",
            "Use useMemo/useCallback to prevent unnecessary re-renders",
            "Split code by route with React.lazy + Suspense",
            "Use Next.js Image component for automatic optimization",
            "Virtualize long lists with react-window or @tanstack/virtual",
            "Avoid prop drilling — use context or Zustand/Jotai",
            "Prefetch data with SWR or React Query",
        ])

    elif domain == "web":
        box("App Interface Guidelines", [
            "accessibilityLabel: Add to all icon-only interactive elements",
            "touch-targets: Min 44pt iOS / 48dp Android",
            "safe-areas: Respect notch, Dynamic Island, gesture bar",
            "Dynamic Type: Support system text scaling on iOS",
            "keyboard-avoidance: Handle keyboard showing/hiding gracefully",
            "haptic-feedback: Use for confirmations and important actions",
        ])

    elif domain == "landing":
        box("Landing Page Structure", [
            "1. Hero: Clear headline, sub-headline, primary CTA, hero image",
            "2. Social proof: Logos, stats, or short testimonials",
            "3. Features: 3–6 key benefits with icons",
            "4. How it works: 3-step visual flow",
            "5. Testimonials: Real quotes with photos",
            "6. Pricing: Clear tiers with CTA per tier",
            "7. FAQ: 5–8 common objections",
            "8. Final CTA: Repeat primary action",
        ])

    elif domain == "prompt":
        results = search_styles(tokens, 1)
        if results:
            box(f"AI Prompt — {results[0]['name']}", ["Keywords: " + results[0]['prompt']])
        else:
            box("AI Prompt", ["No matching style found. Try: glassmorphism, minimal, dark mode, brutal"])

    else:
        print(f"Unknown domain '{domain}'. Available: style, color, typography, product, ux, chart, react, web, landing, prompt")
        sys.exit(1)

# ── Stack search ───────────────────────────────────────────────────────────────

def stack_search(query, stack):
    stack = stack.lower().replace(" ", "-").replace("_", "-")
    tokens = query.lower().split()

    if stack == "react-native":
        box("React Native Guidelines", [
            "Navigation  : Use @react-navigation/native; support back-swipe (iOS) and predictive back (Android)",
            "Lists       : Use FlashList or FlatList with keyExtractor; avoid ScrollView for long lists",
            "Images      : Use expo-image or FastImage for caching; always set width/height",
            "Touch       : Use Pressable over TouchableOpacity; hitSlop for small targets",
            "Keyboard    : Use KeyboardAvoidingView + behavior='padding' (iOS) or 'height' (Android)",
            "Safe Area   : Wrap root with SafeAreaProvider; use useSafeAreaInsets()",
            "Performance : Use useCallback for FlatList renderItem; memo for list items",
            "Accessibility: Set accessibilityLabel, accessibilityRole, accessibilityState",
            "Gestures    : Use react-native-gesture-handler; never block system gestures",
        ])
    else:
        print(f"Stack '{stack}' not found. Available: react-native")
        sys.exit(1)

# ── Persist design system ──────────────────────────────────────────────────────

def persist(query, project, page):
    import os, datetime
    tokens = query.lower().split()
    style = search_styles(tokens, 1)[0]
    palette = search_colors(tokens, 1)[0]
    font = search_fonts(tokens, 1)[0]
    product = search_products(tokens, 1)[0]

    ds_dir = os.path.join(os.getcwd(), "design-system")
    pages_dir = os.path.join(ds_dir, "pages")
    os.makedirs(pages_dir, exist_ok=True)

    master_path = os.path.join(ds_dir, "MASTER.md")
    with open(master_path, "w") as f:
        f.write(f"# Design System Master — {project or 'Project'}\n\n")
        f.write(f"_Generated: {datetime.date.today()}_\n\n")
        f.write(f"## Product\n- Type: {product['type']}\n- Recommended Style: {product['style']}\n\n")
        f.write(f"## Style\n- **{style['name']}**: {style['description']}\n- Prompt: `{style['prompt']}`\n\n")
        f.write(f"## Colors — {palette['name']}\n- Light: {' / '.join(palette['light'])}\n- Dark: {' / '.join(palette['dark'])}\n\n")
        f.write(f"## Typography\n- Heading: **{font['heading']}** | Body: **{font['body']}**\n- Style: {font['style']}\n\n")
        f.write("## Core Rules\n- Spacing: 4/8dp grid\n- Border radius: 8–16px\n- Focus rings: 2–4px\n- Touch targets: ≥44pt\n- Body contrast: ≥4.5:1\n")
    print(f"✓ Design system saved to: {master_path}")

    if page:
        page_path = os.path.join(pages_dir, f"{page.lower().replace(' ', '-')}.md")
        with open(page_path, "w") as f:
            f.write(f"# Page Override — {page}\n\n_Inherits from MASTER.md — add deviations below_\n\n## Overrides\n\n")
        print(f"✓ Page override created: {page_path}")

# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="UI/UX Pro Max — Design Intelligence Search")
    parser.add_argument("query", help="Search query (keywords)")
    parser.add_argument("--design-system", action="store_true", help="Generate full design system")
    parser.add_argument("--domain", "-d", help="Search specific domain: style, color, typography, product, ux, chart, react, web, landing, prompt")
    parser.add_argument("--stack", "-s", help="Stack guidelines: react-native")
    parser.add_argument("-n", "--max-results", type=int, default=3, help="Max results to return")
    parser.add_argument("-p", "--project", default="", help="Project name")
    parser.add_argument("-f", "--format", default="ascii", choices=["ascii", "markdown"], help="Output format")
    parser.add_argument("--persist", action="store_true", help="Save design system to design-system/MASTER.md")
    parser.add_argument("--page", default="", help="Page name for override file (used with --persist)")
    args = parser.parse_args()

    if args.design_system:
        design_system(args.query, args.project, args.format)
        if args.persist:
            persist(args.query, args.project, args.page)
    elif args.domain:
        domain_search(args.query, args.domain, args.max_results, args.format)
    elif args.stack:
        stack_search(args.query, args.stack)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
