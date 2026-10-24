import { Link } from "react-router-dom";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";

const modules = [
  { number: "01", title: "Website Builder", detail: "Build pages, shape your story and publish your own website.", href: "/websites", mark: <I.desktop />, wide: true, soon: false },
  { number: "02", title: "Design & Templates", detail: "A visual design workspace with reusable layouts and brand-ready templates.", href: "/studio/design", mark: <I.layers />, wide: true, soon: true },
  { number: "03", title: "Photo Editor", detail: "Crop, resize, adjust and export clean raster images on your device.", href: "/studio/photo", mark: <I.image />, soon: false },
  { number: "04", title: "Image Compressor", detail: "Choose a smaller output format and quality, then compare real file savings.", href: "/studio/compress", mark: <I.image />, soon: false },
  { number: "05", title: "File Converter", detail: "A focused roadmap for safe, transparent image format conversion.", href: "/studio/convert", mark: <I.history />, soon: true },
  { number: "06", title: "Form Builder", detail: "Plan forms that fit your site, with clear ownership and submission handling.", href: "/studio/forms", mark: <I.pages />, soon: true },
];

export function StudioHome() {
  return (
    <StudioShell>
      <main className="studio-main">
        <section className="studio-hero studio-motion">
          <div className="studio-hero-copy">
            <span className="studio-eyebrow">Your independent studio</span>
            <h1 className="studio-title">One studio.<br />More ways to create.</h1>
            <p className="studio-lede">Build websites, prepare photos and grow your creative work in one creator-owned workspace. Start with the working tools; see what is coming next.</p>
            <Link to="/websites" className="btn btn-primary btn-lg">Open Website Builder <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section aria-labelledby="modules-heading" className="studio-motion-delay">
          <div className="studio-section-head">
            <div>
              <span className="studio-eyebrow">One workspace, useful tools</span>
              <h2 id="modules-heading">Pick up where you need to work</h2>
            </div>
            <p className="small">Six focused tools. Your work stays yours.</p>
          </div>
          <div className="studio-module-grid">
            {modules.map((module) => (
              <Link key={module.number} to={module.href} className={`studio-module${module.wide ? " wide" : ""}`} aria-label={`${module.title}${module.soon ? ", coming soon" : ""}`}>
                <span className="module-index">{module.number} / BINHI</span>
                <span className="module-mark" aria-hidden="true">{module.mark}</span>
                <h3>{module.title}</h3>
                <p>{module.detail}</p>
                {module.soon ? <span className="module-soon">Coming soon</span> : <span className="module-arrow" aria-hidden="true">↗</span>}
              </Link>
            ))}
          </div>
        </section>

        <aside className="studio-note">
          <span className="studio-note-mark" aria-hidden="true">i</span>
          <div><strong>Your files, your device.</strong><p>Photo projects and exports are processed in your browser. They are not cloud backups, and nothing is uploaded to a website unless you choose a destination.</p></div>
        </aside>
      </main>
    </StudioShell>
  );
}
