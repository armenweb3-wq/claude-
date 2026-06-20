"use client";

import { useEffect, useState } from "react";

// Cookie consent banner matching the live site. Choice is stored locally so it
// only shows once. Swap the handlers for your real analytics opt-in if needed.
export default function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("hb-cookie-consent")) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function decide(value: "accepted" | "declined") {
    try {
      localStorage.setItem("hb-cookie-consent", value);
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-coal-line bg-coal-soft/95 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <p className="text-sm text-bone/70">
        We use cookies to keep bookings smooth and improve the site. See our{" "}
        <a href="#" className="text-brass hover:text-brass-soft">
          Privacy Policy
        </a>
        .
      </p>
      <div className="mt-3 flex shrink-0 gap-3 sm:mt-0">
        <button
          onClick={() => decide("declined")}
          className="flex-1 rounded-full border border-coal-line px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-bone/70 transition-colors hover:border-bone/40 hover:text-bone sm:flex-none"
        >
          Decline
        </button>
        <button
          onClick={() => decide("accepted")}
          className="shine flex-1 rounded-full bg-brass px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft sm:flex-none"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
