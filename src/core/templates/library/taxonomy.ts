/**
 * Template Library taxonomy: exactly 30 canonical top-level categories with
 * stable ids, their subcategories, the format-first filters and the style
 * vocabulary. This file is data only. A category existing here never implies
 * that public templates exist for it; availability comes from the catalog and
 * from the editors that can really open a template (see ./editors.ts).
 */
import type { EditorId } from "./editors.js";

export const FORMAT_IDS = ["social", "websites", "print", "documents", "presentations", "forms", "video", "custom"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

/** Primary, format-first filters. "all" is a filter value, never a template format. */
export const FORMAT_FILTERS: readonly { id: "all" | FormatId; label: string }[] = [
  { id: "all", label: "All Templates" },
  { id: "social", label: "Social Media" },
  { id: "websites", label: "Websites" },
  { id: "print", label: "Print" },
  { id: "documents", label: "Documents" },
  { id: "presentations", label: "Presentations" },
  { id: "forms", label: "Forms" },
  { id: "video", label: "Video" },
  { id: "custom", label: "Custom" },
];

export const STYLE_IDS = [
  "minimal",
  "editorial",
  "modern",
  "corporate",
  "artistic",
  "organic",
  "retro",
  "playful",
  "elegant",
  "brutalist",
  "creative-studio",
  "fashion",
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLE_LABEL: Record<StyleId, string> = {
  minimal: "Minimal",
  editorial: "Editorial",
  modern: "Modern",
  corporate: "Corporate",
  artistic: "Artistic",
  organic: "Organic",
  retro: "Retro",
  playful: "Playful",
  elegant: "Elegant",
  brutalist: "Brutalist",
  "creative-studio": "Creative studio",
  fashion: "Fashion",
};

export const ORIENTATIONS = ["landscape", "portrait", "square", "responsive"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export interface CategoryDef {
  /** 1-30; fixed forever. */
  number: number;
  /** Stable slug id; never reused. */
  id: string;
  name: string;
  /** Formats a template in this category may declare. */
  formats: readonly FormatId[];
  /** Editors that may be the required editor of a template whose primary category this is. */
  editors: readonly EditorId[];
  subcategories: readonly string[];
}

export interface Subcategory {
  /** `<category id>/<slug>`: unique across the taxonomy even when two categories share a name. */
  id: string;
  categoryId: string;
  name: string;
}

function def(number: number, id: string, name: string, formats: FormatId[], editors: EditorId[], subcategories: string[]): CategoryDef {
  return { number, id, name, formats, editors, subcategories };
}

export const CATEGORIES: readonly CategoryDef[] = [
  def(1, "social-media", "Social Media", ["social"], ["design"], ["Instagram posts", "Instagram Stories", "Instagram carousel posts", "Reels covers", "Facebook graphics", "TikTok covers", "Pinterest pins", "LinkedIn graphics", "YouTube thumbnails", "Channel banners"]),
  def(2, "websites-landing-pages", "Websites & Landing Pages", ["websites"], ["website"], ["Personal websites", "Creative portfolios", "Business websites", "Agency websites", "Freelancer websites", "Blogs", "Product landing pages", "Event websites", "Link-in-bio pages", "Service websites"]),
  def(3, "logos-brand-identity", "Logos & Brand Identity", ["custom", "print"], ["design"], ["Logos", "Monograms", "Wordmarks", "Brand boards", "Moodboards", "Color palettes", "Typography sheets", "Brand guidelines", "Social branding kits", "Business identity packages"]),
  def(4, "posters-flyers", "Posters & Flyers", ["print", "social"], ["design"], ["Event posters", "Promotional flyers", "Concert posters", "Recruitment flyers", "Exhibition posters", "Sale announcements", "Community notices", "Educational posters", "Artistic posters", "Digital flyers"]),
  def(5, "presentations-pitch-decks", "Presentations & Pitch Decks", ["presentations"], ["presentation"], ["Business presentations", "Startup pitch decks", "Investor presentations", "Project proposals", "Portfolio presentations", "Educational presentations", "Conference presentations", "Workshop slides", "Product presentations", "Company overviews"]),
  def(6, "documents-reports", "Documents & Reports", ["documents", "print"], ["document", "design"], ["Resumes", "Cover letters", "Reports", "Proposals", "Letterheads", "Meeting agendas", "Manuals", "Newsletters", "Company profiles", "Business documents"]),
  def(7, "forms-surveys", "Forms & Surveys", ["forms"], ["form"], ["Contact forms", "Registration forms", "Feedback forms", "Surveys", "Booking requests", "Client intake forms", "Applications", "Questionnaires", "Consent forms", "Quizzes"]),
  def(8, "marketing-advertising", "Marketing & Advertising", ["social", "print", "custom"], ["design"], ["Digital advertisements", "Promotional campaigns", "Product launches", "Sales graphics", "Marketing banners", "Lead magnets", "Media kits", "Campaign graphics", "Promotional collections", "Advertising presentations"]),
  def(9, "invitations-events", "Invitations & Events", ["print", "social"], ["design"], ["Wedding invitations", "Birthday invitations", "Save-the-date cards", "Event programs", "Tickets", "RSVP designs", "Seating charts", "Party decorations", "Thank-you cards", "Celebration announcements"]),
  def(10, "business-essentials", "Business Essentials", ["print", "documents"], ["design", "document"], ["Business cards", "Invoices", "Quotes", "Receipts", "Price lists", "Service menus", "Certificates", "ID cards", "Business stationery", "Company profiles"]),
  def(11, "food-hospitality", "Food & Hospitality", ["print", "social"], ["design"], ["Restaurant menus", "Café menus", "Beverage menus", "Recipe cards", "Food promotions", "Table cards", "Catering brochures", "Hotel guides", "Hospitality signage", "Food advertising graphics"]),
  def(12, "packaging-product-labels", "Packaging & Product Labels", ["print", "custom"], ["design"], ["Product labels", "Stickers", "Box sleeves", "Bottle labels", "Cosmetics packaging", "Food packaging labels", "Hang tags", "Wrapping patterns", "Packaging inserts", "Product mockups"]),
  def(13, "books-publishing", "Books & Publishing", ["print", "documents"], ["design", "document"], ["Book covers", "eBook covers", "Magazine covers", "Editorial spreads", "Zines", "Journals", "Children’s book layouts", "Workbooks", "Reading trackers", "Author media kits"]),
  def(14, "education-learning", "Education & Learning", ["documents", "print", "presentations"], ["design", "document", "presentation"], ["Worksheets", "Flashcards", "Lesson plans", "Study guides", "Certificates", "Classroom posters", "Educational presentations", "Learning activities", "Revision sheets", "Training materials"]),
  def(15, "infographics-diagrams", "Infographics & Diagrams", ["custom", "documents"], ["design"], ["Timelines", "Flowcharts", "Organizational charts", "Comparison graphics", "Statistical infographics", "Process diagrams", "Data summaries", "Roadmaps", "Educational diagrams", "Visual reports"]),
  def(16, "ui-ux-digital-products", "UI/UX & Digital Products", ["custom"], ["design"], ["App screens", "Website wireframes", "Dashboard layouts", "Interface mockups", "Onboarding screens", "Component boards", "Product previews", "Mobile layouts", "User-flow diagrams", "Prototype presentations"]),
  def(17, "video-motion-graphics", "Video & Motion Graphics", ["video"], ["video"], ["Video intros", "Outros", "Lower thirds", "Animated titles", "Storyboards", "Video covers", "Caption layouts", "Reels compositions", "TikTok compositions", "Promotional video graphics"]),
  def(18, "photography-collages", "Photography & Collages", ["custom", "social", "print"], ["design", "photo"], ["Photo collages", "Moodboards", "Photo books", "Contact sheets", "Before-and-after comparisons", "Photography portfolios", "Framed compositions", "Photo grids", "Image galleries", "Scrapbook layouts"]),
  def(19, "fashion-beauty-lifestyle", "Fashion, Beauty & Lifestyle", ["social", "print"], ["design"], ["Lookbooks", "Modeling comp cards", "Beauty promotions", "Salon menus", "Fashion editorials", "Product launches", "Lifestyle moodboards", "Fashion campaigns", "Beauty portfolios", "Style guides"]),
  def(20, "real-estate-architecture", "Real Estate & Architecture", ["print", "documents", "websites"], ["design", "website", "document"], ["Property listings", "Property brochures", "Open-house flyers", "Architectural portfolios", "Floor-plan presentations", "Interior-design boards", "Real estate advertisements", "Property reports", "Project showcases", "Development proposals"]),
  def(21, "travel-tourism", "Travel & Tourism", ["print", "documents", "social"], ["design", "document"], ["Travel itineraries", "Destination guides", "Postcards", "Trip planners", "Tour brochures", "Travel maps", "Travel journals", "Travel posters", "Tourism campaigns", "Accommodation guides"]),
  def(22, "health-fitness-wellness", "Health, Fitness & Wellness", ["print", "social", "documents"], ["design", "document"], ["Workout plans", "Fitness trackers", "Wellness journals", "Yoga schedules", "Gym promotions", "Meal planners", "Health-awareness graphics", "Fitness challenges", "Wellness calendars", "Lifestyle trackers"]),
  def(23, "nonprofits-community", "Nonprofits & Community", ["print", "social", "documents"], ["design", "document"], ["Fundraising campaigns", "Charity posters", "Volunteer recruitment", "Awareness campaigns", "Community announcements", "Nonprofit reports", "Donation graphics", "Outreach flyers", "Event posters", "Community newsletters"]),
  def(24, "email-newsletters", "Email & Newsletters", ["custom"], ["email", "design"], ["Promotional emails", "Newsletters", "Welcome emails", "Event announcements", "Email banners", "Signature layouts", "Product updates", "Marketing announcements", "Customer communications", "Email campaign graphics"]),
  def(25, "planners-productivity", "Planners & Productivity", ["print", "documents"], ["design", "document"], ["Daily planners", "Weekly planners", "Monthly calendars", "Habit trackers", "Project boards", "Goal planners", "Checklists", "Budget planners", "Schedules", "Productivity worksheets"]),
  def(26, "merchandise-print-on-demand", "Merchandise & Print-on-Demand", ["custom"], ["design"], ["T-shirt graphics", "Hoodie designs", "Tote bag graphics", "Mug designs", "Phone cases", "Apparel prints", "Stickers", "Merchandise logos", "Promotional merchandise", "Product graphics"]),
  def(27, "seasonal-holiday", "Seasonal & Holiday", ["social", "print"], ["design"], ["Christmas", "New Year", "Halloween", "Valentine’s Day", "Easter", "Mother’s Day", "Father’s Day", "Birthdays", "Seasonal campaigns", "Regional celebrations"]),
  def(28, "portfolios-personal-branding", "Portfolios & Personal Branding", ["websites", "documents", "custom"], ["website", "design"], ["Creative portfolios", "Freelancer profiles", "Professional biographies", "Case studies", "Personal websites", "CV portfolios", "Press kits", "Artist portfolios", "Photography portfolios", "Professional media kits"]),
  def(29, "music-podcasts-entertainment", "Music, Podcasts & Entertainment", ["social", "custom", "print"], ["design"], ["Album covers", "Podcast covers", "Music posters", "Playlist covers", "Episode graphics", "Streaming banners", "Entertainment promotions", "Event artwork", "Artist media kits", "Performance announcements"]),
  def(30, "blank-custom-creations", "Blank & Custom Creations", ["custom", "websites"], ["design", "website"], ["Blank square canvas", "Blank portrait canvas", "Blank landscape canvas", "Custom dimensions", "User-created templates", "Reusable layouts", "Custom document formats", "Empty website", "Experimental compositions", "Custom creative projects"]),
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SUBCATEGORIES: readonly Subcategory[] = CATEGORIES.flatMap((c) =>
  c.subcategories.map((name) => ({ id: `${c.id}/${slugify(name)}`, categoryId: c.id, name })),
);

const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const subcategoryById = new Map(SUBCATEGORIES.map((s) => [s.id, s]));

export function getCategory(id: string): CategoryDef | undefined {
  return categoryById.get(id);
}
export function getSubcategory(id: string): Subcategory | undefined {
  return subcategoryById.get(id);
}
