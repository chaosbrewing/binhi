import { Link } from "react-router-dom";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";

export type ComingSoonTool = "design" | "convert" | "forms" | "pdf";
type ToolPlan = { name: string; eyebrow: string; intro: string; milestones: { title: string; copy: string }[] };
const plans: Record<ComingSoonTool, ToolPlan> = {
  design: {
    name: "Design & Templates", eyebrow: "Design workspace", intro: "A place to build and reuse visual systems for the web—without splitting your work across another product.",
    milestones: [
      { title: "Posts, flyers and business cards", copy: "A dedicated artboard editor with text, shapes and images, separate from your website canvas." },
      { title: "Reusable templates and design kits", copy: "Reuse owned layouts, type, colors and assets with explicit licensing and permissions." },
      { title: "Presentations and print exports", copy: "Multi-page designs, verified PDF/image exports and print sizing come after the first design workspace." },
    ],
  },
  convert: {
    name: "File Converter", eyebrow: "Format tools", intro: "Conversion is being scoped around supported, inspectable image formats—not a claim that every file type can be converted.",
    milestones: [
      { title: "Raster formats already work in Photo Editor", copy: "Use Photo Editor now for PNG, JPEG and static WebP exports, with verified dimensions and output bytes. A dedicated general converter is not available yet." },
      { title: "No surprise uploads", copy: "Keep processing in the browser where practical and clearly explain any destination before a file leaves your device." },
      { title: "Honest format boundaries", copy: "No promises for PDF, Office documents, SVG or animated image conversion in this release." },
    ],
  },
  forms: {
    name: "Form Creator", eyebrow: "Forms for your site", intro: "A form tool should cover more than fields. We are designing the path from a useful form to a trustworthy submission workflow.",
    milestones: [
      { title: "Build a standalone form", copy: "Text, email, number, choice, date and consent fields with typed validation; conditional logic comes later." },
      { title: "Protect every submission", copy: "Server-side validation, spam controls, private owner permissions and retention rules before release." },
      { title: "Publish and collect safely", copy: "Versioned forms with public links and private submissions. Existing website contact forms remain available in Website Builder." },
    ],
  },
  pdf: {
    name: "PDF Editor", eyebrow: "Document tools", intro: "Safe PDF editing needs predictable rendering, privacy boundaries and verified exports. This capability is planned, not available yet.",
    milestones: [
      { title: "Inspect before editing", copy: "Show page count, dimensions and supported features before making any changes." },
      { title: "Protect document privacy", copy: "Explain when processing stays local and require an explicit action before any upload." },
      { title: "Export verified output", copy: "Validate the resulting PDF structure and preserve the original document." },
    ],
  },
};

export function ComingSoon({ tool }: { tool: ComingSoonTool }) {
  const plan = plans[tool];
  return (
    <StudioShell>
      <main className="studio-main">
        <Link to="/" className="btn btn-ghost"><span aria-hidden="true">←</span> Back to Today</Link>
        <section className="studio-hero studio-motion" style={{ marginTop: 18 }}>
          <div className="studio-hero-copy">
            <span className="studio-eyebrow">{plan.eyebrow} · In the works</span>
            <h1 className="studio-title">{plan.name}</h1>
            <p className="studio-lede">{plan.intro}</p>
            <span className="badge">Planned, not available yet</span>
          </div>
        </section>
        <section aria-labelledby="roadmap-heading">
          <div className="studio-section-head"><div><span className="studio-eyebrow">A scoped roadmap</span><h2 id="roadmap-heading">What this tool is being shaped to do</h2></div></div>
          <div className="studio-roadmap">
            {plan.milestones.map((milestone, index) => (
              <article className="roadmap-item" key={milestone.title}>
                <span className="module-index">STEP 0{index + 1}</span>
                <h3>{milestone.title}</h3>
                <p>{milestone.copy}</p>
              </article>
            ))}
          </div>
        </section>
        <aside className="studio-note">
          <span className="studio-note-mark" aria-hidden="true">i</span>
          <div><strong>No placeholder actions.</strong><p>This module is not enabled yet. Nothing is uploaded, converted or saved here. You can use the working Website Builder or Photo Editor in the meantime.</p>
            <div className="photo-actions" style={{ marginTop: 12 }}><Link to="/websites" className="btn btn-primary">Go to websites</Link><Link to="/studio/photo" className="btn">Open Photo Editor</Link></div>
          </div>
        </aside>
      </main>
    </StudioShell>
  );
}
