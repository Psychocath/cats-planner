import Script from "next/script";

// The planner UI is plain DOM code in /public/planner.js; this page gives it its shell.
const VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 12);

const icon = (paths: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const GEAR = icon(
  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
);
const TAB = (v: string, label: string, paths: string) => `<button data-v="${v}">${icon(paths)}${label}</button>`;

const SHELL = `
<div class="wrap">
  <header class="top">
    <div class="daterow">
      <button class="icon" id="out" aria-label="Zoom out">${icon('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>')}</button>
      <h1 id="dtitle"><small id="dsub"></small><span id="dmain"></span></h1>
      <button class="icon" id="prev" aria-label="Previous">${icon('<path d="M15 6l-6 6 6 6"/>')}</button>
      <button class="icon" id="next" aria-label="Next">${icon('<path d="M9 6l6 6-6 6"/>')}</button>
      <button class="icon" id="search" aria-label="Search">${icon('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>')}</button>
      <button class="icon" id="gear" aria-label="Settings">${GEAR}</button>
    </div>
    <button class="nowbar" id="nowbar" hidden></button>
  </header>
  <div id="status" class="banner" hidden></div>
  <main id="view"></main>
</div>
<div id="dock" class="dock" hidden></div>
<button class="fab" id="fab" aria-label="Add">${icon('<path d="M12 5v14M5 12h14"/>')}</button>
<nav class="tabs" aria-label="Views"><div class="in">
  ${TAB("home", "Home", '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>')}
  ${TAB("cal", "Calendar", '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>')}
  ${TAB("tasks", "Tasks", '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>')}
</div></nav>
<div id="sheetRoot"></div>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
`;

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: SHELL }} />
      <Script src={`/planner.js?v=${VERSION}`} strategy="afterInteractive" />
    </>
  );
}
