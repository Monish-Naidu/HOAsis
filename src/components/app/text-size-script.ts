/**
 * The Text size pre-paint script, kept out of text-size.tsx because a
 * "use client" module cannot hand a plain string to the server layout.
 */
export const TEXT_SIZE_KEY = "hoasis-text-size";

/** Runs before paint, beside themeScript, so text never jumps on reload. */
export const textSizeScript = `(function(){try{var s=localStorage.getItem("${TEXT_SIZE_KEY}");if(s==="large"||s==="largest")document.documentElement.dataset.textSize=s;}catch(e){}})();`;
