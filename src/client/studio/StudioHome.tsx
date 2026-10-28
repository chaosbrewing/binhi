import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ProjectSummary, type SiteSummary, type TemplateSummary } from "../api.js";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";

type QuickAction = { label: string; prompt: string; to: string };
type HomeTemplate = { id: string; title: string; subtitle: string; to: string; swatch?: [string, string, string] };
type FeatureCard = { id: string; title: string; description: string; to: string; icon: ReactNode; soon?: boolean };

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create a social media post", prompt: "Create a social media post", to: "/studio/design" },
  { label: "Design a logo", prompt: "Design a logo", to: "/studio/design" },
  { label: "Edit a photo", prompt: "Edit a photo", to: "/studio/photo" },
  { label: "Make a presentation", prompt: "Make a presentation", to: "/studio/design" },
  { label: "Build a website", prompt: "Build a website", to: "/sites/new" },
];

const FALLBACK_TEMPLATES: HomeTemplate[] = [
  { id: "social-post", title: "Social Media Post", subtitle: "Social Post", to: "/studio/design", swatch: ["#d5f1e0", "#6fc7a4", "#1f6f4a"] },
  { id: "story", title: "Instagram Story", subtitle: "Story", to: "/studio/design", swatch: ["#f9ead6", "#e9be8d", "#8b5e34"] },
  { id: "proposal", title: "Project Proposal", subtitle: "Presentation", to: "/studio/design", swatch: ["#dbe9ff", "#8cb1f7", "#355ca8"] },
  { id: "event", title: "Event Poster", subtitle: "Poster", to: "/studio/design", swatch: ["#daf4d8", "#8cd284", "#2d7f42"] },
  { id: "logo", title: "Starter Logo", subtitle: "Logo", to: "/studio/design", swatch: ["#f0edf9", "#c4b8ec", "#6946b5"] },
  { id: "thumb", title: "Travel Vlog", subtitle: "Video Thumbnail", to: "/studio/design", swatch: ["#dbf5ff", "#8acde5", "#2f7e9c"] },
];

export function StudioHome() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Use the prompt or choose a quick action to begin.");
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [siteTemplates, setSiteTemplates] = useState<TemplateSummary[]>([]);
  const [designTemplates, setDesignTemplates] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.sites(), api.projects(), api.templates(), api.projects("design-template")])
      .then(([siteResult, projectResult, templateResult, designTemplateResult]) => {
        if (!active) return;
        setSites(siteResult.sites);
        setProjects(projectResult.projects);
        setSiteTemplates(templateResult.templates);
        setDesignTemplates(designTemplateResult.projects);
      })
      .catch(() => active && setError("Some homepage content could not be loaded right now."));
    return () => {
      active = false;
    };
  }, []);

  const featureCards = useMemo<FeatureCard[]>(() => {
    const projectCount = sites.length + projects.length;
    return [
      { id: "projects", title: "My Projects", description: projectCount > 0 ? `${projectCount} active project${projectCount === 1 ? "" : "s"} across websites, photos and designs.` : "View and manage all your designs, photos, websites and files.", to: "/projects", icon: <I.layers /> },
      { id: "design", title: "Design Studio", description: "Create stunning graphics, social media posts, and more.", to: "/studio/design", icon: <I.elements /> },
      { id: "photo", title: "Photo Editor", description: "Edit, enhance and transform your photos.", to: "/studio/photo", icon: <I.image /> },
      { id: "templates", title: "Templates", description: "Start with beautiful, customizable templates.", to: "/templates", icon: <I.sections /> },
      { id: "library", title: "Asset Library", description: "Keep your photos, graphics and files organized.", to: "/library", icon: <I.inbox /> },
      { id: "brand", title: "Brand Kits", description: "Save your colors, logos and fonts for a consistent look.", to: "/brand-kits", icon: <I.palette /> },
      { id: "compress", title: "Image Compressor", description: "Reduce file size without losing quality.", to: "/studio/compress", icon: <I.down /> },
      { id: "convert", title: "File Converter", description: "Convert between file formats with clear status and limits.", to: "/studio/convert", icon: <I.history />, soon: true },
      { id: "forms", title: "Form Builder", description: "Create beautiful forms and collect responses.", to: "/studio/forms", icon: <I.pages />, soon: true },
    ];
  }, [sites.length, projects.length]);

  const templates = useMemo<HomeTemplate[]>(() => {
    const fromSites = siteTemplates.slice(0, 4).map((template) => ({
      id: template.id,
      title: template.name,
      subtitle: template.category,
      to: "/sites/new",
      swatch: template.swatch,
    }));
    const fromDesigns = designTemplates.slice(0, 4).map((template) => ({
      id: template.id,
      title: template.name,
      subtitle: "Design Template",
      to: `/studio/design/${template.id}`,
    }));
    const merged = [...fromSites, ...fromDesigns];
    return merged.length > 0 ? merged : FALLBACK_TEMPLATES;
  }, [designTemplates, siteTemplates]);

  const resolvePromptTarget = (value: string) => {
    const phrase = value.toLowerCase();
    if (/(website|landing|site|web page)/.test(phrase)) return { to: "/sites/new", message: "Opening Website Builder starter." };
    if (/(logo|poster|social|presentation|flyer|design|graphic)/.test(phrase)) return { to: "/studio/design", message: "Opening Design Studio to start your draft." };
    if (/(photo|image|retouch|edit|crop|compress|resize)/.test(phrase)) return { to: "/studio/photo", message: "Opening Photo Editor for your request." };
    if (/(template|theme|layout)/.test(phrase)) return { to: "/templates", message: "Opening templates to help you start quickly." };
    if (/(brand|palette|font|logo kit)/.test(phrase)) return { to: "/brand-kits", message: "Opening Brand Kits for your style setup." };
    return { to: "/projects", message: "Opening My Projects while we prepare your workspace." };
  };

  const startFromPrompt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setStatus("Add what you want to create before submitting.");
      return;
    }
    const target = resolvePromptTarget(trimmed);
    setStatus(target.message);
    navigate(target.to);
  };

  const onSubmitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startFromPrompt(prompt);
  };

  return (
    <StudioShell variant="sidebar">
      <main className="studio-main studio-home-main">
        <section className="studio-home-hero studio-motion" aria-labelledby="home-hero-heading">
          <div className="studio-home-hero-copy">
            <h1 className="studio-home-title" id="home-hero-heading">What will you <span>create</span> today?</h1>
            <p className="studio-home-subtitle">Design, edit, and publish — all in one place.</p>
            <form className="studio-home-prompt" onSubmit={onSubmitPrompt}>
              <label htmlFor="home-create-prompt">Describe what you want to create</label>
              <div className="studio-home-prompt-row">
                <input id="home-create-prompt" type="text" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe what you want to create..." autoComplete="off" />
                <button type="submit" className="icon-btn studio-home-send" aria-label="Submit creation prompt">
                  <I.rocket />
                </button>
              </div>
            </form>
            <p className="small muted studio-home-status" role="status" aria-live="polite">{status}</p>
            <ul className="studio-home-quick-actions" aria-label="Quick actions">
              {QUICK_ACTIONS.map((action) => (
                <li key={action.label}>
                  <button
                    type="button"
                    className="studio-home-chip"
                    onClick={() => {
                      setPrompt(action.prompt);
                      setStatus(`Opening ${action.label.toLowerCase()}.`);
                      navigate(action.to);
                    }}
                  >
                    {action.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}

        <section className="studio-motion-delay" aria-labelledby="features-heading">
          <div className="studio-section-head">
            <h2 id="features-heading">Creative tools</h2>
          </div>
          <div className="studio-home-grid" role="list">
            {featureCards.map((card) => (
              <Link key={card.id} to={card.to} role="listitem" className="studio-home-card" aria-label={`${card.title}${card.soon ? ", coming soon" : ""}`}>
                <span className="studio-home-card-icon" aria-hidden="true">{card.icon}</span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                {card.soon ? <span className="studio-side-soon">Soon</span> : null}
              </Link>
            ))}
          </div>
        </section>

        <section className="studio-motion-delay" aria-labelledby="templates-heading">
          <div className="studio-section-head">
            <h2 id="templates-heading">Popular templates</h2>
            <Link to="/templates" className="btn btn-ghost">See all templates <span aria-hidden="true">→</span></Link>
          </div>
          <div className="studio-template-row" role="list" aria-label="Popular templates">
            {templates.map((template) => (
              <Link key={template.id} role="listitem" className="studio-template-card" to={template.to}>
                {template.swatch ? (
                  <span className="studio-template-swatch" aria-hidden="true" style={{ background: `linear-gradient(120deg, ${template.swatch[0]} 0%, ${template.swatch[1]} 55%, ${template.swatch[2]} 100%)` }} />
                ) : (
                  <span className="studio-template-fallback" aria-hidden="true">{template.title.slice(0, 2).toUpperCase()}</span>
                )}
                <strong>{template.title}</strong>
                <span>{template.subtitle}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="studio-motion-delay" aria-labelledby="categories-heading">
          <h2 id="categories-heading">Create anything, your way</h2>
          <p className="muted">From simple edits to complete websites, BINHI gives you tools to bring ideas to life.</p>
          <ul className="studio-home-category-row" aria-label="Creation categories">
            {["Social media content", "Presentations", "Posters and flyers", "Logos and branding", "Photo edits", "Websites", "Print materials", "And more..."].map((category) => (
              <li key={category}>
                <Link to="/templates" className="studio-home-category-chip">{category}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="studio-home-cta" aria-labelledby="home-cta-heading">
          <div>
            <h2 id="home-cta-heading">All your creativity in one place</h2>
            <p>Save time, stay organized, and turn your ideas into something amazing.</p>
          </div>
          <Link to="/studio/design" className="btn btn-primary btn-lg">Start creating now <span aria-hidden="true">→</span></Link>
        </section>
      </main>
    </StudioShell>
  );
}
