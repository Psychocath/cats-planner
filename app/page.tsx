import Script from "next/script";

// The planner UI is plain DOM code in /public/planner.js; this page gives it its shell.
const SHELL = "\n\n<div class=\"wrap\">\n  <header>\n    <div class=\"daterow\">\n      <button class=\"icon\" id=\"prev\" aria-label=\"Previous\">\u2039</button>\n      <h1 id=\"dtitle\"><small id=\"dsub\"></small><span id=\"dmain\"></span></h1>\n      <button class=\"ghost\" id=\"todayBtn\">Today</button>\n      <button class=\"icon\" id=\"next\" aria-label=\"Next\">\u203a</button>\n      <button class=\"icon\" id=\"gear\" aria-label=\"Settings\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg></button>\n    </div>\n  </header>\n  <div id=\"status\" class=\"banner\" hidden></div>\n  <main id=\"view\"></main>\n</div>\n<button class=\"fab\" id=\"fab\">+ Add</button>\n<nav class=\"tabs\" aria-label=\"Views\"><div class=\"in\">\n  <button data-v=\"day\"><svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/></svg>Today</button>\n  <button data-v=\"week\"><svg viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M9 3v4M15 3v4\"/></svg>Week</button>\n  <button data-v=\"tasks\"><svg viewBox=\"0 0 24 24\"><path d=\"M9 6h11M9 12h11M9 18h11\"/><path d=\"M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2\"/></svg>Tasks</button>\n  <button data-v=\"routines\"><svg viewBox=\"0 0 24 24\"><path d=\"M4 12a8 8 0 0 1 14-5.3L20 9\"/><path d=\"M20 4v5h-5\"/><path d=\"M20 12a8 8 0 0 1-14 5.3L4 15\"/><path d=\"M4 20v-5h5\"/></svg>Routines</button>\n</div></nav>\n<div id=\"sheetRoot\"></div>\n<div id=\"toast\" class=\"toast\" hidden></div>\n\n";

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: SHELL }} />
      <Script src="/planner.js" strategy="afterInteractive" />
    </>
  );
}
